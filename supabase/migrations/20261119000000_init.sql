-- baomemory · initial schema
-- Tier: 1 = core (always in digest candidates), 2 = active, 3 = archived

create extension if not exists vector with schema extensions;

create table if not exists public.memories (
  id           uuid primary key default gen_random_uuid(),
  content      text        not null check (char_length(content) between 1 and 4000),
  kind         text        not null default 'fact'
                 check (kind in ('fact','preference','decision','project','person','event','note')),
  tags         text[]      not null default '{}',
  tier         smallint    not null default 2 check (tier between 1 and 3),
  importance   smallint    not null default 3 check (importance between 1 and 5),
  source       text,
  embedding    extensions.vector(1024),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  accessed_at  timestamptz not null default now()
);

create index if not exists memories_embedding_hnsw
  on public.memories using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists memories_tags_gin   on public.memories using gin (tags);
create index if not exists memories_tier_upd   on public.memories (tier, updated_at desc);

create table if not exists public.digest (
  id          text primary key default 'main',
  content     text        not null,
  source_ids  uuid[]      not null default '{}',
  updated_at  timestamptz not null default now()
);

-- updated_at trigger
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists memories_touch on public.memories;
create trigger memories_touch before update on public.memories
  for each row execute function public.touch_updated_at();

-- Hybrid search: vector rank + keyword rank fused with Reciprocal Rank Fusion
create or replace function public.search_memories(
  query_text       text,
  query_embedding  extensions.vector(1024),
  match_count      int      default 8,
  filter_tags      text[]   default null,
  include_archived boolean  default false
) returns table (
  id uuid, content text, kind text, tags text[], tier smallint, importance smallint,
  source text, created_at timestamptz, updated_at timestamptz, similarity float, score float
)
language sql stable set search_path = '' as $$
  with base as (
    select m.* from public.memories m
    where (include_archived or m.tier < 3)
      and (filter_tags is null or m.tags && filter_tags)
  ),
  vec as (
    select b.id, 1 - (b.embedding operator(extensions.<=>) query_embedding) as sim,
           row_number() over (order by b.embedding operator(extensions.<=>) query_embedding) as r
    from base b where b.embedding is not null
    order by b.embedding operator(extensions.<=>) query_embedding
    limit greatest(match_count * 4, 20)
  ),
  kw as (
    select b.id, row_number() over (order by b.importance desc, b.updated_at desc) as r
    from base b
    where query_text is not null and query_text <> ''
      and strpos(lower(b.content), lower(query_text)) > 0
    limit greatest(match_count * 4, 20)
  ),
  fused as (
    select coalesce(v.id, k.id) as id,
           coalesce(v.sim, 0) as sim,
           coalesce(1.0 / (60 + v.r), 0) + coalesce(1.0 / (60 + k.r), 0) as score
    from vec v full outer join kw k on v.id = k.id
  )
  select b.id, b.content, b.kind, b.tags, b.tier, b.importance, b.source,
         b.created_at, b.updated_at, f.sim::float, f.score::float
  from fused f join base b on b.id = f.id
  order by f.score desc
  limit match_count;
$$;

-- Nearest neighbour used for de-duplication on write
create or replace function public.nearest_memory(
  query_embedding extensions.vector(1024)
) returns table (id uuid, similarity float)
language sql stable set search_path = '' as $$
  select m.id, (1 - (m.embedding operator(extensions.<=>) query_embedding))::float
  from public.memories m
  where m.tier < 3 and m.embedding is not null
  order by m.embedding operator(extensions.<=>) query_embedding
  limit 1;
$$;

-- Archive stale, low-importance memories
create or replace function public.archive_stale(stale_days int default 90, max_importance int default 2)
returns int language sql volatile set search_path = '' as $$
  with a as (
    update public.memories set tier = 3
    where tier = 2 and importance <= max_importance
      and accessed_at < now() - make_interval(days => stale_days)
    returning 1
  ) select count(*)::int from a;
$$;

create or replace function public.touch_accessed(ids uuid[]) returns void
language sql volatile set search_path = '' as $$
  update public.memories set accessed_at = now() where id = any(ids);
$$;

-- Lock down: only the service role (used by the Worker) can read or write
alter table public.memories enable row level security;
alter table public.digest   enable row level security;
revoke all on public.memories, public.digest from anon, authenticated;
revoke execute on function public.search_memories, public.nearest_memory,
  public.archive_stale, public.touch_accessed from public, anon, authenticated;
grant execute on function public.search_memories, public.nearest_memory,
  public.archive_stale, public.touch_accessed to service_role;

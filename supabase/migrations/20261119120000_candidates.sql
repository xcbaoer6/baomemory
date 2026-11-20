-- baomemory · review queue for imported / extracted memories.
-- Nothing here is recalled until it is approved into public.memories.

create table if not exists public.memory_candidates (
  id          uuid primary key default gen_random_uuid(),
  content     text        not null check (char_length(content) between 1 and 4000),
  kind        text        not null default 'fact'
                check (kind in ('fact','preference','decision','project','person','event','note')),
  tags        text[]      not null default '{}',
  importance  smallint    not null default 3 check (importance between 1 and 5),
  source      text,
  evidence    text        check (evidence is null or char_length(evidence) <= 1000),
  created_at  timestamptz not null default now()
);

create index if not exists memory_candidates_created on public.memory_candidates (created_at desc);

alter table public.memory_candidates enable row level security;
revoke all on public.memory_candidates from anon, authenticated;

import type { SupabaseClient } from '@supabase/supabase-js';
import type { MemoryPatch, NewMemory } from '../../../core/domain/memory';
import { notFound, upstream } from '../../../core/errors';
import type { ListQuery, MemoryRepository, SearchQuery, Vector } from '../../../core/ports';
import { createSupabase } from './client';
import {
  type DigestRow,
  MEMORY_COLUMNS,
  type MemoryRow,
  type ScoredRow,
  toDigest,
  toMemory,
  toPgVector,
  toScored,
} from './mapper';

export interface SupabaseRepositoryOptions {
  readonly url: string;
  readonly serviceKey: string;
}

const unwrap = <T>({ data, error }: { data: T | null; error: unknown }): T => {
  if (error) throw upstream('supabase', error);
  return data as T;
};

const toRow = (m: Partial<NewMemory>) => ({
  ...(m.content !== undefined && { content: m.content }),
  ...(m.kind !== undefined && { kind: m.kind }),
  ...(m.tags !== undefined && { tags: [...m.tags] }),
  ...(m.tier !== undefined && { tier: m.tier }),
  ...(m.importance !== undefined && { importance: m.importance }),
  ...(m.source !== undefined && { source: m.source }),
});

export class SupabaseMemoryRepository implements MemoryRepository {
  readonly #db: SupabaseClient;

  constructor({ url, serviceKey }: SupabaseRepositoryOptions) {
    this.#db = createSupabase({ url, serviceKey });
  }

  async insert(memory: NewMemory, embedding: Vector) {
    const row = unwrap<MemoryRow>(
      await this.#db
        .from('memories')
        .insert({ ...toRow(memory), embedding: toPgVector(embedding) })
        .select(MEMORY_COLUMNS)
        .single(),
    );
    return toMemory(row);
  }

  async update(id: string, patch: MemoryPatch, embedding?: Vector) {
    const row = unwrap<MemoryRow | null>(
      await this.#db
        .from('memories')
        .update({ ...toRow(patch), ...(embedding && { embedding: toPgVector(embedding) }) })
        .eq('id', id)
        .select(MEMORY_COLUMNS)
        .maybeSingle(),
    );
    if (!row) throw notFound('memory');
    return toMemory(row);
  }

  async remove(id: string) {
    unwrap(await this.#db.from('memories').delete().eq('id', id));
  }

  async get(id: string) {
    const row = unwrap<MemoryRow | null>(
      await this.#db.from('memories').select(MEMORY_COLUMNS).eq('id', id).maybeSingle(),
    );
    return row ? toMemory(row) : null;
  }

  async list({ tags, tiers, limit, offset = 0, updatedSince }: ListQuery) {
    let q = this.#db
      .from('memories')
      .select(MEMORY_COLUMNS)
      .order('importance', { ascending: false })
      .order('updated_at', { ascending: false })
      .order('id')
      .range(offset, offset + limit - 1);
    if (tags?.length) q = q.overlaps('tags', [...tags]);
    if (tiers?.length) q = q.in('tier', [...tiers]);
    if (updatedSince) q = q.gte('updated_at', updatedSince);
    return unwrap<MemoryRow[]>(await q).map(toMemory);
  }

  async search({ text, embedding, limit, tags, includeArchived }: SearchQuery) {
    const rows = unwrap<ScoredRow[]>(
      await this.#db.rpc('search_memories', {
        query_text: text,
        query_embedding: toPgVector(embedding),
        match_count: limit,
        filter_tags: tags?.length ? [...tags] : null,
        include_archived: includeArchived ?? false,
      }),
    );
    return rows.map(toScored);
  }

  async nearest(embedding: Vector) {
    const rows = unwrap<{ id: string; similarity: number }[]>(
      await this.#db.rpc('nearest_memory', { query_embedding: toPgVector(embedding) }),
    );
    return rows[0] ?? null;
  }

  async touch(ids: readonly string[]) {
    unwrap(await this.#db.rpc('touch_accessed', { ids: [...ids] }));
  }

  async archiveStale(staleDays: number, maxImportance: number) {
    return unwrap<number>(
      await this.#db.rpc('archive_stale', { stale_days: staleDays, max_importance: maxImportance }),
    );
  }

  async getDigest() {
    const row = unwrap<DigestRow | null>(
      await this.#db.from('digest').select('content,source_ids,updated_at').eq('id', 'main').maybeSingle(),
    );
    return row ? toDigest(row) : null;
  }

  async saveDigest({ content, sourceIds }: { content: string; sourceIds: readonly string[] }) {
    const row = unwrap<DigestRow>(
      await this.#db
        .from('digest')
        .upsert({ id: 'main', content, source_ids: [...sourceIds], updated_at: new Date().toISOString() })
        .select('content,source_ids,updated_at')
        .single(),
    );
    return toDigest(row);
  }
}

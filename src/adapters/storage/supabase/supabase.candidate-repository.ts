import type { SupabaseClient } from '@supabase/supabase-js';
import type { Candidate, NewCandidate } from '../../../core/domain/candidate';
import type { Importance, MemoryKind } from '../../../core/domain/memory';
import { upstream } from '../../../core/errors';
import type { CandidateRepository } from '../../../core/ports';
import { createSupabase } from './client';

interface CandidateRow {
  id: string;
  content: string;
  kind: string;
  tags: string[];
  importance: number;
  source: string | null;
  evidence: string | null;
  created_at: string;
}

const COLUMNS = 'id,content,kind,tags,importance,source,evidence,created_at';
const TABLE = 'memory_candidates';

const toCandidate = (r: CandidateRow): Candidate => ({
  id: r.id,
  content: r.content,
  kind: r.kind as MemoryKind,
  tags: r.tags,
  importance: r.importance as Importance,
  source: r.source,
  evidence: r.evidence,
  createdAt: r.created_at,
});

const check = <T>({ data, error }: { data: T | null; error: unknown }): T => {
  if (error) throw upstream('supabase', error);
  return data as T;
};

export class SupabaseCandidateRepository implements CandidateRepository {
  readonly #db: SupabaseClient;

  constructor(options: { readonly url: string; readonly serviceKey: string }) {
    this.#db = createSupabase(options);
  }

  async addMany(candidates: readonly NewCandidate[]) {
    if (!candidates.length) return 0;
    check(await this.#db.from(TABLE).insert(candidates.map((c) => ({ ...c, tags: [...c.tags] }))));
    return candidates.length;
  }

  async list(limit: number) {
    const rows = check<CandidateRow[]>(
      await this.#db.from(TABLE).select(COLUMNS).order('created_at', { ascending: false }).limit(limit),
    );
    return rows.map(toCandidate);
  }

  async count() {
    const { count, error } = await this.#db.from(TABLE).select('id', { count: 'exact', head: true });
    if (error) throw upstream('supabase', error);
    return count ?? 0;
  }

  async getMany(ids: readonly string[]) {
    if (!ids.length) return [];
    return check<CandidateRow[]>(
      await this.#db
        .from(TABLE)
        .select(COLUMNS)
        .in('id', [...ids]),
    ).map(toCandidate);
  }

  async removeMany(ids: readonly string[]) {
    if (!ids.length) return;
    check(
      await this.#db
        .from(TABLE)
        .delete()
        .in('id', [...ids]),
    );
  }
}

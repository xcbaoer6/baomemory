import type { Digest, Importance, Memory, MemoryKind, ScoredMemory, Tier } from '../../../core/domain/memory';
import type { Vector } from '../../../core/ports';

export interface MemoryRow {
  id: string;
  content: string;
  kind: string;
  tags: string[];
  tier: number;
  importance: number;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScoredRow extends MemoryRow {
  similarity: number;
  score: number;
}

export interface DigestRow {
  content: string;
  source_ids: string[];
  updated_at: string;
}

export const MEMORY_COLUMNS = 'id,content,kind,tags,tier,importance,source,created_at,updated_at';

/** pgvector accepts the JSON array literal as text. */
export const toPgVector = (v: Vector): string => `[${v.join(',')}]`;

export const toMemory = (r: MemoryRow): Memory => ({
  id: r.id,
  content: r.content,
  kind: r.kind as MemoryKind,
  tags: r.tags,
  tier: r.tier as Tier,
  importance: r.importance as Importance,
  source: r.source,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const toScored = (r: ScoredRow): ScoredMemory => ({
  ...toMemory(r),
  similarity: r.similarity,
  score: r.score,
});

export const toDigest = (r: DigestRow): Digest => ({
  content: r.content,
  sourceIds: r.source_ids,
  updatedAt: r.updated_at,
});

import type { Digest, Memory, MemoryPatch, NewMemory, ScoredMemory } from '../domain/memory';

export type Vector = readonly number[];

export interface SearchQuery {
  readonly text: string;
  readonly embedding: Vector;
  readonly limit: number;
  readonly tags?: readonly string[];
  readonly includeArchived?: boolean;
}

export interface ListQuery {
  readonly tags?: readonly string[];
  readonly tiers?: readonly number[];
  readonly limit: number;
  readonly offset?: number;
  readonly updatedSince?: string;
}

/** Storage port. Any database can be plugged in by implementing this. */
export interface MemoryRepository {
  insert(memory: NewMemory, embedding: Vector): Promise<Memory>;
  update(id: string, patch: MemoryPatch, embedding?: Vector): Promise<Memory>;
  remove(id: string): Promise<void>;
  get(id: string): Promise<Memory | null>;
  list(query: ListQuery): Promise<Memory[]>;
  search(query: SearchQuery): Promise<ScoredMemory[]>;
  nearest(embedding: Vector): Promise<{ id: string; similarity: number } | null>;
  touch(ids: readonly string[]): Promise<void>;
  archiveStale(staleDays: number, maxImportance: number): Promise<number>;
  getDigest(): Promise<Digest | null>;
  saveDigest(digest: Omit<Digest, 'updatedAt'>): Promise<Digest>;
}

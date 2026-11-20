import type { Digest, Memory, MemoryPatch, NewMemory, ScoredMemory } from '../../../core/domain/memory';
import { Tier } from '../../../core/domain/memory';
import { notFound } from '../../../core/errors';
import type { ListQuery, MemoryRepository, SearchQuery, Vector } from '../../../core/ports';

interface Entry {
  memory: Memory;
  embedding: Vector;
  accessedAt: number;
}

const cosine = (a: Vector, b: Vector) => {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

const byRank = (a: Memory, b: Memory) =>
  b.importance - a.importance || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);

/** Zero-dependency adapter for tests and local development. */
export class InMemoryMemoryRepository implements MemoryRepository {
  readonly #entries = new Map<string, Entry>();
  #digest: Digest | null = null;
  #now = () => new Date().toISOString();

  async insert(m: NewMemory, embedding: Vector) {
    const now = this.#now();
    const memory: Memory = { ...m, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    this.#entries.set(memory.id, { memory, embedding, accessedAt: Date.now() });
    return memory;
  }

  async update(id: string, patch: MemoryPatch, embedding?: Vector) {
    const entry = this.#entries.get(id);
    if (!entry) throw notFound('memory');
    const memory: Memory = { ...entry.memory, ...patch, updatedAt: this.#now() };
    this.#entries.set(id, { ...entry, memory, embedding: embedding ?? entry.embedding });
    return memory;
  }

  async remove(id: string) {
    this.#entries.delete(id);
  }

  async get(id: string) {
    return this.#entries.get(id)?.memory ?? null;
  }

  async list({ tags, tiers, limit, offset = 0, updatedSince }: ListQuery) {
    return [...this.#entries.values()]
      .map((e) => e.memory)
      .filter((m) => !tags?.length || m.tags.some((t) => tags.includes(t)))
      .filter((m) => !tiers?.length || tiers.includes(m.tier))
      .filter((m) => !updatedSince || m.updatedAt >= updatedSince)
      .sort(byRank)
      .slice(offset, offset + limit);
  }

  async search({ text, embedding, limit, tags, includeArchived }: SearchQuery): Promise<ScoredMemory[]> {
    const needle = text.toLowerCase();
    return [...this.#entries.values()]
      .filter((e) => includeArchived || e.memory.tier !== Tier.Archived)
      .filter((e) => !tags?.length || e.memory.tags.some((t) => tags.includes(t)))
      .map((e) => {
        const similarity = cosine(e.embedding, embedding);
        const keyword = needle && e.memory.content.toLowerCase().includes(needle) ? 0.1 : 0;
        return { ...e.memory, similarity, score: similarity + keyword };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async nearest(embedding: Vector) {
    let best: { id: string; similarity: number } | null = null;
    for (const e of this.#entries.values()) {
      if (e.memory.tier === Tier.Archived) continue;
      const similarity = cosine(e.embedding, embedding);
      if (!best || similarity > best.similarity) best = { id: e.memory.id, similarity };
    }
    return best;
  }

  async touch(ids: readonly string[]) {
    for (const id of ids) {
      const e = this.#entries.get(id);
      if (e) e.accessedAt = Date.now();
    }
  }

  async archiveStale(staleDays: number, maxImportance: number) {
    const cutoff = Date.now() - staleDays * 86_400_000;
    let n = 0;
    for (const e of this.#entries.values()) {
      const m = e.memory;
      if (m.tier === Tier.Active && m.importance <= maxImportance && e.accessedAt < cutoff) {
        e.memory = { ...m, tier: Tier.Archived };
        n++;
      }
    }
    return n;
  }

  async getDigest() {
    return this.#digest;
  }

  async saveDigest(d: Omit<Digest, 'updatedAt'>) {
    this.#digest = { ...d, updatedAt: this.#now() };
    return this.#digest;
  }
}

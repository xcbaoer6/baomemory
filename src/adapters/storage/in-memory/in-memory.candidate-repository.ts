import type { Candidate, NewCandidate } from '../../../core/domain/candidate';
import type { CandidateRepository } from '../../../core/ports';

/** Zero-dependency review queue for tests and local development. */
export class InMemoryCandidateRepository implements CandidateRepository {
  readonly #items = new Map<string, Candidate>();

  async addMany(candidates: readonly NewCandidate[]) {
    for (const c of candidates) {
      const id = crypto.randomUUID();
      this.#items.set(id, { ...c, tags: [...c.tags], id, createdAt: new Date().toISOString() });
    }
    return candidates.length;
  }

  async list(limit: number) {
    return [...this.#items.values()].reverse().slice(0, limit);
  }

  async count() {
    return this.#items.size;
  }

  async getMany(ids: readonly string[]) {
    return ids.map((id) => this.#items.get(id)).filter((c): c is Candidate => c !== undefined);
  }

  async removeMany(ids: readonly string[]) {
    for (const id of ids) this.#items.delete(id);
  }
}

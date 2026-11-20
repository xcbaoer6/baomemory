import type { ScoredMemory } from '../domain/memory';
import type { ServiceDeps } from './deps';

export interface RecallInput {
  readonly query: string;
  readonly limit?: number;
  readonly tags?: readonly string[];
  readonly includeArchived?: boolean;
}

export const createRecallService =
  ({ repo, embedder, defer }: Pick<ServiceDeps, 'repo' | 'embedder' | 'defer'>) =>
  async ({ query, limit = 8, tags, includeArchived = false }: RecallInput): Promise<ScoredMemory[]> => {
    const embedding = await embedder.embedQuery(query);
    const hits = await repo.search({ text: query, embedding, limit, tags, includeArchived });
    if (hits.length) defer(repo.touch(hits.map((h) => h.id)));
    return hits;
  };

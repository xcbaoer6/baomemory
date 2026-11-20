import type { Memory, MemoryPatch } from '../domain/memory';
import { notFound, rejected } from '../errors';
import type { ListQuery } from '../ports';
import type { ServiceDeps } from './deps';

export const createManageService = ({
  repo,
  embedder,
  guard,
}: Pick<ServiceDeps, 'repo' | 'embedder' | 'guard'>) => ({
  async get(id: string): Promise<Memory> {
    const memory = await repo.get(id);
    if (!memory) throw notFound('memory');
    return memory;
  },

  list: (query: ListQuery) => repo.list(query),

  async update(id: string, patch: MemoryPatch): Promise<Memory> {
    if (patch.content === undefined) return repo.update(id, patch);
    const content = patch.content.trim();
    const verdict = guard.inspect(content);
    if (!verdict.ok) throw rejected(verdict.reason);
    const [embedding] = await embedder.embedDocuments([content]);
    return repo.update(id, { ...patch, content }, embedding);
  },

  async forget(id: string): Promise<void> {
    if (!(await repo.get(id))) throw notFound('memory');
    await repo.remove(id);
  },
});

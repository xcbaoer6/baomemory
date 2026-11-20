import { type Memory, type NewMemory, Tier } from '../domain/memory';
import { rejected } from '../errors';
import type { ServiceDeps } from './deps';

export interface RememberInput extends Partial<Omit<NewMemory, 'content'>> {
  readonly content: string;
}

export interface RememberResult {
  readonly action: 'created' | 'merged';
  readonly memory: Memory;
}

const normalizeTags = (tags: readonly string[] = []) =>
  [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 16);

export const createRememberService =
  ({ repo, embedder, guard, policy }: Pick<ServiceDeps, 'repo' | 'embedder' | 'guard' | 'policy'>) =>
  async (input: RememberInput): Promise<RememberResult> => {
    const content = input.content.trim();
    const verdict = guard.inspect(content);
    if (!verdict.ok) throw rejected(verdict.reason);

    const [embedding] = await embedder.embedDocuments([content]);
    if (!embedding) throw rejected('embedding failed');

    const draft: NewMemory = {
      content,
      kind: input.kind ?? 'fact',
      tags: normalizeTags(input.tags),
      tier: input.tier ?? Tier.Active,
      importance: input.importance ?? 3,
      source: input.source ?? null,
    };

    const nearest = await repo.nearest(embedding);
    if (nearest && nearest.similarity >= policy.dedupeThreshold) {
      const memory = await repo.update(nearest.id, draft, embedding);
      return { action: 'merged', memory };
    }
    return { action: 'created', memory: await repo.insert(draft, embedding) };
  };

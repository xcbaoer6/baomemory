import { Tier } from '../domain/memory';
import type { ServiceDeps } from './deps';

export interface CompactionReport {
  readonly summarized: number;
  readonly archived: number;
  readonly digestChars: number;
}

export const createCompactionService =
  ({ repo, summarizer, policy }: Pick<ServiceDeps, 'repo' | 'summarizer' | 'policy'>) =>
  async (): Promise<CompactionReport> => {
    const archived = await repo.archiveStale(policy.archiveAfterDays, policy.archiveMaxImportance);
    const [previous, memories] = await Promise.all([
      repo.getDigest(),
      repo.list({ tiers: [Tier.Core, Tier.Active], limit: policy.digestSourceLimit }),
    ]);
    if (!memories.length) return { summarized: 0, archived, digestChars: previous?.content.length ?? 0 };

    const content = await summarizer.summarize(memories, previous?.content ?? null, policy.digestMaxChars);
    await repo.saveDigest({ content, sourceIds: memories.map((m) => m.id) });
    return { summarized: memories.length, archived, digestChars: content.length };
  };

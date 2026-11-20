import { type Memory, Tier } from '../domain/memory';
import type { ServiceDeps } from './deps';

export interface ContextResult {
  /** Ready-to-read L1 context for an assistant. */
  readonly text: string;
  readonly digestUpdatedAt: string | null;
  readonly core: Memory[];
}

const bullet = (m: Memory) => `- ${m.content}`;

export const createContextService =
  ({ repo }: Pick<ServiceDeps, 'repo'>) =>
  async (): Promise<ContextResult> => {
    const [digest, core] = await Promise.all([
      repo.getDigest(),
      repo.list({ tiers: [Tier.Core], limit: 30 }),
    ]);

    const sections = [
      digest?.content ? `## 摘要\n${digest.content}` : null,
      core.length ? `## 核心\n${core.map(bullet).join('\n')}` : null,
    ].filter((s): s is string => s !== null);

    if (!sections.length) {
      const recent = await repo.list({ tiers: [Tier.Active], limit: 15 });
      if (recent.length) sections.push(`## 最近\n${recent.map(bullet).join('\n')}`);
    }

    return {
      text: sections.join('\n\n') || '（记忆库还是空的）',
      digestUpdatedAt: digest?.updatedAt ?? null,
      core,
    };
  };

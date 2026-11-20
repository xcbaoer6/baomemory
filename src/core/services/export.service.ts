import { formatEntry } from '../domain/entry-format';
import type { Memory } from '../domain/memory';
import type { ServiceDeps } from './deps';

export type ExportFormat = 'md' | 'jsonl';
const PAGE = 500;

export const createExportService =
  ({ repo }: Pick<ServiceDeps, 'repo'>) =>
  async (format: ExportFormat, includeArchived = true): Promise<string> => {
    const tiers = includeArchived ? undefined : [1, 2];
    const all: Memory[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const page = await repo.list({ limit: PAGE, offset, tiers });
      all.push(...page);
      if (page.length < PAGE) break;
    }
    if (format === 'jsonl') return all.map((m) => JSON.stringify(m)).join('\n');
    const head = `# baomemory 导出 · ${new Date().toISOString().slice(0, 10)} · ${all.length} 条\n\n`;
    return head + all.map(formatEntry).join('\n') + (all.length ? '\n' : '');
  };

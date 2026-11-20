import type { NewCandidate } from '../domain/candidate';
import { parseEntries } from '../domain/entry-format';
import { rejected } from '../errors';
import type { ServiceDeps } from './deps';
import type { RememberInput, RememberResult } from './remember.service';

export type ImportMode = 'direct' | 'review';

export interface EntryImportReport {
  readonly parsed: number;
  readonly created: number;
  readonly merged: number;
  readonly queued: number;
  readonly rejected: { readonly content: string; readonly reason: string }[];
}

export interface ChatImportInput {
  readonly transcript: string;
  /** review (default): facts wait in the queue. direct: facts are remembered at once (dedupe still applies). */
  readonly mode?: ImportMode;
  readonly title?: string;
  readonly date?: string;
  readonly source?: string;
}

const preview = (s: string) => (s.length > 60 ? `${s.slice(0, 59)}…` : s);

type Deps = Pick<ServiceDeps, 'candidates' | 'extractor' | 'guard' | 'policy'> & {
  readonly remember: (input: RememberInput) => Promise<RememberResult>;
};

export const createImportService = ({ candidates, extractor, guard, policy, remember }: Deps) => ({
  /** Tidied lines (see entry-format). Direct writes go through remember, so dedupe and the guard apply. */
  async entries(text: string, mode: ImportMode, source = 'import'): Promise<EntryImportReport> {
    const parsed = parseEntries(text);
    const report = {
      parsed: parsed.length,
      created: 0,
      merged: 0,
      queued: 0,
      rejected: [] as EntryImportReport['rejected'][number][],
    };
    const accepted: typeof parsed = [];
    for (const e of parsed) {
      const verdict = guard.inspect(e.content);
      if (verdict.ok) accepted.push(e);
      else report.rejected.push({ content: preview(e.content), reason: verdict.reason });
    }

    if (mode === 'review') {
      report.queued = await candidates.addMany(
        accepted.map((e) => ({
          content: e.content,
          kind: e.kind ?? 'fact',
          tags: e.tags,
          importance: e.importance ?? 3,
          source,
          evidence: null,
        })),
      );
      return report;
    }

    for (const e of accepted) {
      const { action } = await remember({ ...e, source });
      report[action === 'created' ? 'created' : 'merged']++;
    }
    return report;
  },

  /** One slice of a chat history → extracted facts → review queue, or straight into memory. */
  async chat({ transcript, title, date, source = 'chat-import', mode = 'review' }: ChatImportInput) {
    const report = { queued: 0, created: 0, merged: 0, dropped: 0 };
    const text = transcript.trim();
    if (!text) return report;
    if (text.length > policy.extractMaxChars) {
      throw rejected(`transcript too long (max ${policy.extractMaxChars} characters per request)`);
    }
    const facts = await extractor.extract({ transcript: text, title, date });
    const label = title ? `${source}: ${title}`.slice(0, 200) : source;
    const safe = facts.filter((f) => guard.inspect(f.content).ok);
    report.dropped = facts.length - safe.length;

    if (mode === 'review') {
      report.queued = await candidates.addMany(safe.map((f): NewCandidate => ({ ...f, source: label })));
      return report;
    }
    // Sequential so each fact can merge into one remembered just before it.
    for (const { evidence: _evidence, ...fact } of safe) {
      const { action } = await remember({ ...fact, source: label });
      report[action]++;
    }
    return report;
  },
});

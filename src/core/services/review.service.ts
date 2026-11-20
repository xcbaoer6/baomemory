import type { Candidate } from '../domain/candidate';
import type { MemoryKind } from '../domain/memory';
import type { ServiceDeps } from './deps';
import type { RememberInput, RememberResult } from './remember.service';

export interface ApproveEdit {
  readonly content?: string;
  readonly kind?: MemoryKind;
  readonly tags?: string[];
  readonly importance?: number;
}

type Deps = Pick<ServiceDeps, 'candidates'> & {
  readonly remember: (input: RememberInput) => Promise<RememberResult>;
};

type Outcome =
  | { readonly id: string; readonly action: 'created' | 'merged' }
  | { readonly id: string; readonly action: 'failed'; readonly reason: string };

export const createReviewService = ({ candidates, remember }: Deps) => {
  const settle = async (c: Candidate, edit: ApproveEdit = {}): Promise<Outcome> => {
    try {
      const { action } = await remember({
        content: edit.content ?? c.content,
        kind: edit.kind ?? c.kind,
        tags: edit.tags ?? c.tags,
        importance: edit.importance ?? c.importance,
        source: c.source ?? undefined,
      });
      return { id: c.id, action };
    } catch (e) {
      return { id: c.id, action: 'failed', reason: e instanceof Error ? e.message : 'failed' };
    }
  };

  return {
    async list(limit: number) {
      const [items, total] = await Promise.all([candidates.list(limit), candidates.count()]);
      return { items, total };
    },

    /** Approved candidates go through remember (guard + dedupe), then leave the queue. */
    async approve(ids: readonly string[], edits: Readonly<Record<string, ApproveEdit>> = {}) {
      const found = await candidates.getMany(ids);
      // Sequential on purpose: each approval may merge into one approved just before it.
      const outcomes: Outcome[] = [];
      for (const c of found) outcomes.push(await settle(c, edits[c.id]));
      const done = outcomes.filter((o) => o.action !== 'failed').map((o) => o.id);
      if (done.length) await candidates.removeMany(done);
      return {
        created: outcomes.filter((o) => o.action === 'created').length,
        merged: outcomes.filter((o) => o.action === 'merged').length,
        failed: outcomes.flatMap((o) => (o.action === 'failed' ? [{ id: o.id, reason: o.reason }] : [])),
      };
    },

    async reject(ids: readonly string[]) {
      await candidates.removeMany(ids);
      return { removed: ids.length };
    },
  };
};

import type { Importance, MemoryKind } from './memory';

/** A proposed memory waiting for review. Never recalled until approved. */
export interface Candidate {
  readonly id: string;
  readonly content: string;
  readonly kind: MemoryKind;
  readonly tags: string[];
  readonly importance: Importance;
  readonly source: string | null;
  /** Short quote from the original material the candidate was drawn from. */
  readonly evidence: string | null;
  readonly createdAt: string;
}

export type NewCandidate = Omit<Candidate, 'id' | 'createdAt'>;

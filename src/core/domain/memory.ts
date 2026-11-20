export const MEMORY_KINDS = ['fact', 'preference', 'decision', 'project', 'person', 'event', 'note'] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

/** 1 = core, 2 = active, 3 = archived */
export const Tier = { Core: 1, Active: 2, Archived: 3 } as const;
export type Tier = (typeof Tier)[keyof typeof Tier];

/** 1 (trivial) … 5 (critical); validated at the edges. */
export type Importance = number;

export interface Memory {
  readonly id: string;
  readonly content: string;
  readonly kind: MemoryKind;
  readonly tags: string[];
  readonly tier: Tier;
  readonly importance: Importance;
  readonly source: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ScoredMemory extends Memory {
  readonly similarity: number;
  readonly score: number;
}

export interface NewMemory {
  readonly content: string;
  readonly kind: MemoryKind;
  readonly tags: string[];
  readonly tier: Tier;
  readonly importance: Importance;
  readonly source: string | null;
}

export type MemoryPatch = Partial<Omit<NewMemory, 'content'>> & { readonly content?: string };

export interface Digest {
  readonly content: string;
  readonly sourceIds: string[];
  readonly updatedAt: string;
}

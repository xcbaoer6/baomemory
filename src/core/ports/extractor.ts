import type { MemoryKind } from '../domain/memory';

export interface ExtractedFact {
  readonly content: string;
  readonly kind: MemoryKind;
  readonly importance: number;
  readonly tags: string[];
  readonly evidence: string | null;
}

/** Turns a slice of conversation into durable facts about the user. */
export interface Extractor {
  extract(input: {
    readonly transcript: string;
    readonly title?: string;
    readonly date?: string;
  }): Promise<ExtractedFact[]>;
}

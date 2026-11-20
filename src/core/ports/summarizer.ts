import type { Memory } from '../domain/memory';

/** Summarizer port: condenses memories into a short digest. */
export interface Summarizer {
  summarize(memories: readonly Memory[], previous: string | null, maxChars: number): Promise<string>;
}

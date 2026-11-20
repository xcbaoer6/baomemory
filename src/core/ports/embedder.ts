import type { Vector } from './memory-repository';

/** Embedding port. Documents and queries may be encoded differently by the model. */
export interface Embedder {
  readonly dimensions: number;
  embedDocuments(texts: readonly string[]): Promise<Vector[]>;
  embedQuery(text: string): Promise<Vector>;
}

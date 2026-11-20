import { upstream } from '../../core/errors';
import type { Embedder, Vector } from '../../core/ports';
import type { AiRunner } from '../ai-runner';

export interface WorkersAiEmbedderOptions {
  readonly ai: AiRunner;
  readonly model?: string;
  readonly dimensions?: number;
  readonly instruction?: string;
}

interface EmbeddingOutput {
  data?: number[][];
}

export class WorkersAiEmbedder implements Embedder {
  readonly dimensions: number;
  readonly #ai: AiRunner;
  readonly #model: string;
  readonly #instruction: string;

  constructor({
    ai,
    model = '@cf/qwen/qwen3-embedding-0.6b',
    dimensions = 1024,
    instruction = 'Given a question about the user, retrieve memories that answer it',
  }: WorkersAiEmbedderOptions) {
    this.#ai = ai;
    this.#model = model;
    this.dimensions = dimensions;
    this.#instruction = instruction;
  }

  async embedDocuments(texts: readonly string[]): Promise<Vector[]> {
    return this.#run({ documents: [...texts] }, texts.length);
  }

  async embedQuery(text: string): Promise<Vector> {
    const [vector] = await this.#run({ queries: [text], instruction: this.#instruction }, 1);
    return vector as Vector;
  }

  async #run(input: Record<string, unknown>, expected: number): Promise<Vector[]> {
    let out: EmbeddingOutput;
    try {
      out = (await this.#ai.run(this.#model, input)) as EmbeddingOutput;
    } catch (cause) {
      throw upstream('workers-ai embedding', cause);
    }
    const data = out.data ?? [];
    if (data.length !== expected || data.some((v) => v.length !== this.dimensions)) {
      throw upstream('workers-ai embedding: unexpected shape');
    }
    return data;
  }
}

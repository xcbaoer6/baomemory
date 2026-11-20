import { PatternSecretGuard } from '../../src/adapters/guard/pattern.secret-guard';
import { InMemoryCandidateRepository } from '../../src/adapters/storage/in-memory/in-memory.candidate-repository';
import { InMemoryMemoryRepository } from '../../src/adapters/storage/in-memory/in-memory.repository';
import type { Embedder, ExtractedFact, Extractor, Summarizer, Vector } from '../../src/core/ports';
import { createServices, DEFAULT_POLICY } from '../../src/core/services';

/** Deterministic character-bigram embedder: similar strings get similar vectors. */
export class BigramEmbedder implements Embedder {
  readonly dimensions = 256;
  embed(text: string): Vector {
    const v = new Array<number>(this.dimensions).fill(0);
    const s = text.toLowerCase();
    for (let i = 0; i < s.length - 1; i++) {
      const h = (s.charCodeAt(i) * 31 + s.charCodeAt(i + 1)) % this.dimensions;
      v[h] = (v[h] ?? 0) + 1;
    }
    return v;
  }
  async embedDocuments(texts: readonly string[]) {
    return texts.map((t) => this.embed(t));
  }
  async embedQuery(text: string) {
    return this.embed(text);
  }
}

export class JoinSummarizer implements Summarizer {
  async summarize(memories: readonly { content: string }[]) {
    return memories.map((m) => `- ${m.content}`).join('\n');
  }
}

/** Returns one fact per line that starts with "用户:". */
export class LineExtractor implements Extractor {
  async extract({ transcript }: { transcript: string }): Promise<ExtractedFact[]> {
    return transcript
      .split('\n')
      .filter((l) => l.startsWith('用户:'))
      .map((l) => ({ content: l.slice(3).trim(), kind: 'fact', importance: 3, tags: [], evidence: l }));
  }
}

export const makeServices = () => {
  const deferred: Promise<unknown>[] = [];
  const repo = new InMemoryMemoryRepository();
  const candidates = new InMemoryCandidateRepository();
  const services = createServices({
    repo,
    candidates,
    extractor: new LineExtractor(),
    embedder: new BigramEmbedder(),
    summarizer: new JoinSummarizer(),
    guard: new PatternSecretGuard(),
    policy: DEFAULT_POLICY,
    defer: (p) => deferred.push(p),
  });
  return { services, repo, candidates, deferred };
};

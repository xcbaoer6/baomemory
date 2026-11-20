import type {
  CandidateRepository,
  Embedder,
  Extractor,
  MemoryRepository,
  SecretGuard,
  Summarizer,
} from '../ports';

export interface MemoryPolicy {
  /** Similarity at or above which a new memory updates its nearest neighbour instead of inserting. */
  readonly dedupeThreshold: number;
  readonly digestMaxChars: number;
  readonly digestSourceLimit: number;
  readonly archiveAfterDays: number;
  readonly archiveMaxImportance: number;
  /** Longest transcript slice accepted for one extraction call. */
  readonly extractMaxChars: number;
}

export interface ServiceDeps {
  readonly repo: MemoryRepository;
  readonly candidates: CandidateRepository;
  readonly extractor: Extractor;
  readonly embedder: Embedder;
  readonly summarizer: Summarizer;
  readonly guard: SecretGuard;
  readonly policy: MemoryPolicy;
  /** Runs work after the response is sent (ctx.waitUntil on Workers). */
  readonly defer: (work: Promise<unknown>) => void;
}

export const DEFAULT_POLICY: MemoryPolicy = {
  dedupeThreshold: 0.92,
  digestMaxChars: 1800,
  digestSourceLimit: 200,
  archiveAfterDays: 90,
  archiveMaxImportance: 2,
  extractMaxChars: 12_000,
};

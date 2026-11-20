import type { Config, Env } from '../config/env';
import type { CandidateRepository, Embedder, Extractor, MemoryRepository, Summarizer } from '../core/ports';
import { WorkersAiEmbedder } from './embedding/workers-ai.embedder';
import { WorkersAiExtractor } from './extractor/workers-ai.extractor';
import { InMemoryCandidateRepository } from './storage/in-memory/in-memory.candidate-repository';
import { InMemoryMemoryRepository } from './storage/in-memory/in-memory.repository';
import { SupabaseCandidateRepository } from './storage/supabase/supabase.candidate-repository';
import { SupabaseMemoryRepository } from './storage/supabase/supabase.repository';
import { WorkersAiSummarizer } from './summarizer/workers-ai.summarizer';

type Factory<T> = (config: Config, env: Env) => T;

/**
 * Plug-in point. Register a new adapter here and select it with the
 * STORAGE_ADAPTER / EMBEDDER_ADAPTER / SUMMARIZER_ADAPTER / EXTRACTOR_ADAPTER variables.
 * The review queue (`candidates`) follows STORAGE_ADAPTER.
 */
export const registry = {
  storage: {
    supabase: (config) => {
      if (!config.supabase) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
      return new SupabaseMemoryRepository(config.supabase);
    },
    'in-memory': () => new InMemoryMemoryRepository(),
  } satisfies Record<string, Factory<MemoryRepository>>,

  candidates: {
    supabase: (config) => {
      if (!config.supabase) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
      return new SupabaseCandidateRepository(config.supabase);
    },
    'in-memory': () => new InMemoryCandidateRepository(),
  } satisfies Record<string, Factory<CandidateRepository>>,

  embedder: {
    'workers-ai': (config, env) => new WorkersAiEmbedder({ ai: env.AI, model: config.models.embedding }),
  } satisfies Record<string, Factory<Embedder>>,

  summarizer: {
    'workers-ai': (config, env) => new WorkersAiSummarizer({ ai: env.AI, model: config.models.summary }),
  } satisfies Record<string, Factory<Summarizer>>,

  extractor: {
    'workers-ai': (config, env) => new WorkersAiExtractor({ ai: env.AI, model: config.models.extract }),
  } satisfies Record<string, Factory<Extractor>>,
} as const;

export const resolve = <T>(kind: keyof typeof registry, name: string, config: Config, env: Env): T => {
  const factory = (registry[kind] as unknown as Record<string, Factory<T>>)[name];
  if (!factory) {
    const known = Object.keys(registry[kind]).join(', ');
    throw new Error(`Unknown ${kind} adapter "${name}". Available: ${known}`);
  }
  return factory(config, env);
};

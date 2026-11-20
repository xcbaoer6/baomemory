import { z } from 'zod';
import type { AiRunner } from '../adapters/ai-runner';

/** Bindings and secrets provided by the Workers runtime (see wrangler.jsonc). */
export interface Env {
  readonly AI: AiRunner;
  readonly API_KEY: string;
  readonly SUPABASE_URL?: string;
  readonly SUPABASE_SERVICE_KEY?: string;
  readonly STORAGE_ADAPTER?: string;
  readonly EMBEDDER_ADAPTER?: string;
  readonly SUMMARIZER_ADAPTER?: string;
  readonly EXTRACTOR_ADAPTER?: string;
  readonly EMBEDDING_MODEL?: string;
  readonly SUMMARY_MODEL?: string;
  readonly EXTRACT_MODEL?: string;
}

const ConfigSchema = z.object({
  apiKey: z.string().min(24, 'API_KEY must be at least 24 characters'),
  adapters: z.object({
    storage: z.string().default('supabase'),
    embedder: z.string().default('workers-ai'),
    summarizer: z.string().default('workers-ai'),
    extractor: z.string().default('workers-ai'),
  }),
  supabase: z.object({ url: z.url(), serviceKey: z.string().min(20) }).optional(),
  models: z.object({
    embedding: z.string().optional(),
    summary: z.string().optional(),
    extract: z.string().optional(),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

export const loadConfig = (env: Env): Config =>
  ConfigSchema.parse({
    apiKey: env.API_KEY,
    adapters: {
      storage: env.STORAGE_ADAPTER,
      embedder: env.EMBEDDER_ADAPTER,
      summarizer: env.SUMMARIZER_ADAPTER,
      extractor: env.EXTRACTOR_ADAPTER,
    },
    supabase:
      env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY
        ? { url: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_KEY }
        : undefined,
    models: { embedding: env.EMBEDDING_MODEL, summary: env.SUMMARY_MODEL, extract: env.EXTRACT_MODEL },
  });

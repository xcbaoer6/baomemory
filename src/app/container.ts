import { PatternSecretGuard } from '../adapters/guard/pattern.secret-guard';
import { resolve } from '../adapters/registry';
import { type Config, type Env, loadConfig } from '../config/env';
import type { CandidateRepository, Embedder, Extractor, MemoryRepository, Summarizer } from '../core/ports';
import { createServices, DEFAULT_POLICY, type Services } from '../core/services';

export interface Container {
  readonly config: Config;
  readonly services: (defer: (work: Promise<unknown>) => void) => Services;
}

const cache = new WeakMap<Env, Container>();

/** Builds adapters once per isolate; services are bound per request to its waitUntil. */
export const getContainer = (env: Env): Container => {
  const hit = cache.get(env);
  if (hit) return hit;

  const config = loadConfig(env);
  const adapters = {
    repo: resolve<MemoryRepository>('storage', config.adapters.storage, config, env),
    candidates: resolve<CandidateRepository>('candidates', config.adapters.storage, config, env),
    extractor: resolve<Extractor>('extractor', config.adapters.extractor, config, env),
    embedder: resolve<Embedder>('embedder', config.adapters.embedder, config, env),
    summarizer: resolve<Summarizer>('summarizer', config.adapters.summarizer, config, env),
    guard: new PatternSecretGuard(),
    policy: DEFAULT_POLICY,
  };

  const container: Container = {
    config,
    services: (defer) => createServices({ ...adapters, defer }),
  };
  cache.set(env, container);
  return container;
};

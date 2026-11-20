import type { Env } from './config/env';
import { createApp } from './http/app';
import { runCompaction } from './jobs/compaction.job';

const app = createApp();

export default {
  fetch: app.fetch,
  scheduled: (_controller, env, ctx) => {
    ctx.waitUntil(runCompaction(env, ctx));
  },
} satisfies ExportedHandler<Env>;

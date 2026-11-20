import { getContainer } from '../app/container';
import type { Env } from '../config/env';

/** Nightly Cron: archive stale memories, rebuild the digest (also keeps the free database active). */
export const runCompaction = async (env: Env, ctx: ExecutionContext) => {
  const services = getContainer(env).services((work) => ctx.waitUntil(work));
  const report = await services.compact();
  console.log(JSON.stringify({ job: 'compaction', ...report }));
};

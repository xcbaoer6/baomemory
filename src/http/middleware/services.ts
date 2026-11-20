import { createMiddleware } from 'hono/factory';
import { getContainer } from '../../app/container';
import type { AppEnv } from '../types';

/** Binds request-scoped services (deferred work runs on ctx.waitUntil). */
export const injectServices = createMiddleware<AppEnv>(async (c, next) => {
  c.set(
    'services',
    getContainer(c.env).services((work) => c.executionCtx.waitUntil(work)),
  );
  await next();
});

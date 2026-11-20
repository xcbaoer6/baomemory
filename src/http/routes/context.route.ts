import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { ContextSchema } from '../schemas';
import type { AppEnv } from '../types';

const security = [{ bearer: [] }];

const context = createRoute({
  method: 'get',
  path: '/context',
  tags: ['context'],
  summary: 'L1 context: digest + core memories, ready to read at the start of a conversation',
  security,
  responses: { 200: { content: { 'application/json': { schema: ContextSchema } }, description: 'Context' } },
});

const compact = createRoute({
  method: 'post',
  path: '/admin/compact',
  tags: ['admin'],
  summary: 'Run compaction now (normally runs nightly via Cron)',
  security,
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ summarized: z.number(), archived: z.number(), digestChars: z.number() }),
        },
      },
      description: 'Report',
    },
  },
});

export const contextRoute = new OpenAPIHono<AppEnv>()
  .openapi(context, async (c) => {
    c.header('cache-control', 'private, max-age=30');
    return c.json(await c.var.services.context(), 200);
  })
  .openapi(compact, async (c) => c.json(await c.var.services.compact(), 200));

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type { AppEnv } from '../types';

const TYPES = { md: 'text/markdown; charset=utf-8', jsonl: 'application/x-ndjson; charset=utf-8' } as const;

const exportAll = createRoute({
  method: 'get',
  path: '/',
  tags: ['export'],
  summary: 'Download every memory as Markdown (re-importable) or JSON Lines',
  security: [{ bearer: [] }],
  request: {
    query: z.object({
      format: z.enum(['md', 'jsonl']).default('md'),
      archived: z.stringbool().default(true),
    }),
  },
  responses: {
    200: { content: { 'text/markdown': { schema: z.string() } }, description: 'Export file' },
  },
});

export const exportRoute = new OpenAPIHono<AppEnv>().openapi(exportAll, async (c) => {
  const { format, archived } = c.req.valid('query');
  const body = await c.var.services.exportAll(format, archived);
  const name = `baomemory-${new Date().toISOString().slice(0, 10)}.${format}`;
  return c.body(body, 200, {
    'Content-Type': TYPES[format],
    'Content-Disposition': `attachment; filename="${name}"`,
  });
});

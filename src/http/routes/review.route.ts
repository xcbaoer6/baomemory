import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { ApproveBodySchema, CandidateSchema, RejectBodySchema } from '../schemas';
import type { AppEnv } from '../types';

const security = [{ bearer: [] }];
const json = <T extends z.ZodType>(schema: T) => ({
  content: { 'application/json': { schema } },
  description: 'OK',
});

const list = createRoute({
  method: 'get',
  path: '/',
  tags: ['review'],
  summary: 'Candidates waiting for review, newest first',
  security,
  request: { query: z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }) },
  responses: { 200: json(z.object({ items: z.array(CandidateSchema), total: z.number() })) },
});

const approve = createRoute({
  method: 'post',
  path: '/approve',
  tags: ['review'],
  summary: 'Approve candidates (optionally edited) into memory',
  security,
  request: { body: { content: { 'application/json': { schema: ApproveBodySchema } }, required: true } },
  responses: {
    200: json(
      z.object({
        created: z.number(),
        merged: z.number(),
        failed: z.array(z.object({ id: z.string(), reason: z.string() })),
      }),
    ),
  },
});

const reject = createRoute({
  method: 'post',
  path: '/reject',
  tags: ['review'],
  summary: 'Discard candidates',
  security,
  request: { body: { content: { 'application/json': { schema: RejectBodySchema } }, required: true } },
  responses: { 200: json(z.object({ removed: z.number() })) },
});

export const reviewRoute = new OpenAPIHono<AppEnv>()
  .openapi(list, async (c) => c.json(await c.var.services.review.list(c.req.valid('query').limit), 200))
  .openapi(approve, async (c) => {
    const { ids, edits } = c.req.valid('json');
    return c.json(await c.var.services.review.approve(ids, edits), 200);
  })
  .openapi(reject, async (c) => c.json(await c.var.services.review.reject(c.req.valid('json').ids), 200));

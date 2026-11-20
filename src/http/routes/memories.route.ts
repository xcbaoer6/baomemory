import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  ErrorSchema,
  IdParamSchema,
  ListQuerySchema,
  MemorySchema,
  PatchBodySchema,
  RememberBodySchema,
  ScoredMemorySchema,
  SearchQuerySchema,
} from '../schemas';
import type { AppEnv } from '../types';

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { 'application/json': { schema } },
  description,
});
const errors = { 404: json(ErrorSchema, 'Not found'), 422: json(ErrorSchema, 'Rejected') };
const security = [{ bearer: [] }];

const remember = createRoute({
  method: 'post',
  path: '/',
  tags: ['memories'],
  summary: 'Store a memory (near-duplicates are merged)',
  security,
  request: { body: { content: { 'application/json': { schema: RememberBodySchema } }, required: true } },
  responses: {
    201: json(z.object({ action: z.enum(['created', 'merged']), memory: MemorySchema }), 'Stored'),
    422: errors[422],
  },
});

const search = createRoute({
  method: 'get',
  path: '/search',
  tags: ['memories'],
  summary: 'Hybrid semantic + keyword search',
  security,
  request: { query: SearchQuerySchema },
  responses: { 200: json(z.object({ items: z.array(ScoredMemorySchema) }), 'Matches') },
});

const list = createRoute({
  method: 'get',
  path: '/',
  tags: ['memories'],
  summary: 'List memories by tag or tier',
  security,
  request: { query: ListQuerySchema },
  responses: { 200: json(z.object({ items: z.array(MemorySchema) }), 'Memories') },
});

const getOne = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['memories'],
  security,
  request: { params: IdParamSchema },
  responses: { 200: json(MemorySchema, 'Memory'), 404: errors[404] },
});

const patch = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['memories'],
  security,
  request: {
    params: IdParamSchema,
    body: { content: { 'application/json': { schema: PatchBodySchema } }, required: true },
  },
  responses: { 200: json(MemorySchema, 'Updated'), ...errors },
});

const remove = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['memories'],
  security,
  request: { params: IdParamSchema },
  responses: { 204: { description: 'Deleted' }, 404: errors[404] },
});

export const memoriesRoute = new OpenAPIHono<AppEnv>()
  .openapi(remember, async (c) => c.json(await c.var.services.remember(c.req.valid('json')), 201))
  .openapi(search, async (c) => {
    const { q, limit, tags, archived } = c.req.valid('query');
    const items = await c.var.services.recall({ query: q, limit, tags, includeArchived: archived });
    return c.json({ items }, 200);
  })
  .openapi(list, async (c) => {
    const { limit, tags, tier } = c.req.valid('query');
    const items = await c.var.services.manage.list({ limit, tags, tiers: tier ? [tier] : undefined });
    return c.json({ items }, 200);
  })
  .openapi(getOne, async (c) => c.json(await c.var.services.manage.get(c.req.valid('param').id), 200))
  .openapi(patch, async (c) =>
    c.json(await c.var.services.manage.update(c.req.valid('param').id, c.req.valid('json')), 200),
  )
  .openapi(remove, async (c) => {
    await c.var.services.manage.forget(c.req.valid('param').id);
    return c.body(null, 204);
  });

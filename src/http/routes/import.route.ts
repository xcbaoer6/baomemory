import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { ImportChatBodySchema, ImportEntriesBodySchema } from '../schemas';
import type { AppEnv } from '../types';

const security = [{ bearer: [] }];
const body = <T extends z.ZodType>(schema: T) => ({
  body: { content: { 'application/json': { schema } }, required: true },
});
const ok = <T extends z.ZodType>(schema: T) => ({
  200: { content: { 'application/json': { schema } }, description: 'Report' },
});

const entries = createRoute({
  method: 'post',
  path: '/entries',
  tags: ['import'],
  summary: 'Import tidied lines: straight into memory, or into the review queue',
  security,
  request: body(ImportEntriesBodySchema),
  responses: ok(
    z.object({
      parsed: z.number(),
      created: z.number(),
      merged: z.number(),
      queued: z.number(),
      rejected: z.array(z.object({ content: z.string(), reason: z.string() })),
    }),
  ),
});

const chat = createRoute({
  method: 'post',
  path: '/chat',
  tags: ['import'],
  summary: 'Extract facts from one slice of a chat history, into the review queue or straight into memory',
  security,
  request: body(ImportChatBodySchema),
  responses: ok(
    z.object({ queued: z.number(), created: z.number(), merged: z.number(), dropped: z.number() }),
  ),
});

export const importRoute = new OpenAPIHono<AppEnv>()
  .openapi(entries, async (c) => {
    const { text, mode, source } = c.req.valid('json');
    return c.json(await c.var.services.imports.entries(text, mode, source), 200);
  })
  .openapi(chat, async (c) => c.json(await c.var.services.imports.chat(c.req.valid('json')), 200));

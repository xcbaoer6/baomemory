import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { MEMORY_KINDS } from '../core/domain/memory';
import type { Services } from '../core/services';

const asText = (value: unknown) => ({
  content: [
    { type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) },
  ],
});

/** Each tool is a thin wrapper over a core service; no business logic lives here. */
export const registerTools = (server: McpServer, services: Services) => {
  server.registerTool(
    'get_context',
    {
      title: 'Get memory context',
      description:
        'Read the compact digest of what is known about the user. Call at the start of a conversation.',
      annotations: { readOnlyHint: true },
    },
    async () => asText((await services.context()).text),
  );

  server.registerTool(
    'recall',
    {
      title: 'Search memories',
      description: 'Semantic + keyword search over stored memories.',
      inputSchema: {
        query: z.string().min(1).describe('What to look for, in natural language'),
        limit: z.number().int().min(1).max(20).optional(),
        tags: z.array(z.string()).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, limit, tags }) => {
      const hits = await services.recall({ query, limit, tags });
      return asText(
        hits.map(({ id, content, kind, tags: t, updatedAt, similarity }) => ({
          id,
          content,
          kind,
          tags: t,
          updatedAt,
          similarity: Number(similarity.toFixed(3)),
        })),
      );
    },
  );

  server.registerTool(
    'remember',
    {
      title: 'Store a memory',
      description:
        'Save one durable fact, preference or decision. Near-duplicates are merged. Never store secrets.',
      inputSchema: {
        content: z.string().min(1).max(4000),
        kind: z.enum(MEMORY_KINDS).optional(),
        tags: z.array(z.string()).max(16).optional(),
        importance: z.number().int().min(1).max(5).optional(),
        core: z.boolean().optional().describe('Pin into the always-loaded core tier'),
      },
    },
    async ({ core, ...input }) => {
      const result = await services.remember({ ...input, tier: core ? 1 : 2, source: 'mcp' });
      return asText({ action: result.action, id: result.memory.id });
    },
  );

  server.registerTool(
    'update_memory',
    {
      title: 'Update a memory',
      description: 'Correct or re-tier an existing memory by id. tier 3 archives it.',
      inputSchema: {
        id: z.uuid(),
        content: z.string().min(1).max(4000).optional(),
        tags: z.array(z.string()).max(16).optional(),
        importance: z.number().int().min(1).max(5).optional(),
        tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
      },
    },
    async ({ id, ...patch }) => asText(await services.manage.update(id, patch)),
  );

  server.registerTool(
    'forget',
    {
      title: 'Delete a memory',
      description: 'Permanently delete a memory by id.',
      inputSchema: { id: z.uuid() },
      annotations: { destructiveHint: true },
    },
    async ({ id }) => {
      await services.manage.forget(id);
      return asText('deleted');
    },
  );
};

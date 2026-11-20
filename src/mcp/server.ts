import { StreamableHTTPTransport } from '@hono/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Hono } from 'hono';
import type { AppEnv } from '../http/types';
import { registerTools } from './tools';

const INFO = { name: 'baomemory', version: '0.1.0' } as const;

/** Stateless Streamable HTTP endpoint: a fresh server per request, nothing shared across isolates. */
export const mcpRoute = new Hono<AppEnv>().all('/', async (c) => {
  const server = new McpServer(INFO, {
    instructions:
      'Personal memory store. Call get_context first, recall for details, remember for new durable facts.',
  });
  registerTools(server, c.var.services);
  const transport = new StreamableHTTPTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(c);
});

import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { mcpRoute } from '../mcp/server';
import { adminRoute } from './admin/admin.route';
import { bearerAuth } from './middleware/auth';
import { onError } from './middleware/error';
import { injectServices } from './middleware/services';
import { contextRoute } from './routes/context.route';
import { exportRoute } from './routes/export.route';
import { importRoute } from './routes/import.route';
import { installRoute } from './routes/install.route';
import { memoriesRoute } from './routes/memories.route';
import { reviewRoute } from './routes/review.route';
import type { AppEnv } from './types';

export const createApp = () => {
  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const message = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        return c.json({ error: { code: 'invalid', message } }, 400);
      }
    },
  });

  app.onError(onError);
  app.use(
    secureHeaders(),
    cors({ origin: '*', allowHeaders: ['authorization', 'content-type', 'mcp-session-id'] }),
  );

  app.get('/health', (c) => c.json({ ok: true }));
  app.route('/admin', adminRoute);
  app.route('/install', installRoute);
  app.openAPIRegistry.registerComponent('securitySchemes', 'bearer', { type: 'http', scheme: 'bearer' });
  app.doc31('/openapi.json', { openapi: '3.1.0', info: { title: 'baomemory', version: '0.1.0' } });

  app.use('/v1/*', bearerAuth, injectServices);
  app.use('/mcp', bearerAuth, injectServices);

  app.route('/v1', contextRoute);
  app.route('/v1/memories', memoriesRoute);
  app.route('/v1/export', exportRoute);
  app.route('/v1/import', importRoute);
  app.route('/v1/candidates', reviewRoute);
  app.route('/mcp', mcpRoute);

  return app;
};

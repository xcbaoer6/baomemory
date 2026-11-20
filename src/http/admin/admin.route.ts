import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { adminPage } from './page';

/**
 * Admin UI: a single static page. It holds no secrets and calls the
 * authenticated /v1 API from the browser with the key the user types in.
 */
export const adminRoute = new Hono<AppEnv>().get('/', (c) => {
  c.header('Cache-Control', 'no-store');
  c.header('X-Robots-Tag', 'noindex');
  return c.html(adminPage);
});

import { createMiddleware } from 'hono/factory';
import { getContainer } from '../../app/container';
import type { AppEnv } from '../types';

const encoder = new TextEncoder();

/** Constant-time comparison over SHA-256 digests (equal length, no early exit). */
const safeEqual = async (a: string, b: string) => {
  const [x, y] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  const va = new Uint8Array(x);
  const vb = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= (va[i] ?? 0) ^ (vb[i] ?? 0);
  return diff === 0;
};

export const bearerAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const { config } = getContainer(c.env);
  if (!token || !(await safeEqual(token, config.apiKey))) {
    return c.json({ error: { code: 'unauthorized', message: 'invalid or missing bearer token' } }, 401);
  }
  await next();
});

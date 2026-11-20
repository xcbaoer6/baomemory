import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';
import { DomainError, type ErrorCode } from '../../core/errors';
import type { AppEnv } from '../types';

const STATUS: Record<ErrorCode, ContentfulStatusCode> = {
  not_found: 404,
  rejected: 422,
  unauthorized: 401,
  upstream: 502,
  invalid: 400,
};

export const onError: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof DomainError) {
    if (err.code === 'upstream') console.error(err.message, err.cause);
    return c.json({ error: { code: err.code, message: err.message } }, STATUS[err.code]);
  }
  if (err instanceof ZodError) {
    return c.json({ error: { code: 'invalid', message: err.issues.map((i) => i.message).join('; ') } }, 400);
  }
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  return c.json({ error: { code: 'internal', message: 'internal error' } }, 500);
};

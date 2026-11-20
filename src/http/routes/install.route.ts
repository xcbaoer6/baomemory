import { Hono } from 'hono';
import { CODEX_HOOK_PY } from '../../integrations/codex/hook-py';
import { CODEX_INSTALL_SH } from '../../integrations/codex/install-sh';
import type { AppEnv } from '../types';

const text = 'text/plain; charset=utf-8';

/** Public installers. They carry no secrets: the key is typed on the user's own terminal. */
export const installRoute = new Hono<AppEnv>()
  .get('/codex.sh', (c) =>
    c.body(CODEX_INSTALL_SH.replaceAll('__BASE__', new URL(c.req.url).origin), 200, { 'Content-Type': text }),
  )
  .get('/codex/baomemory_hook.py', (c) => c.body(CODEX_HOOK_PY, 200, { 'Content-Type': text }));

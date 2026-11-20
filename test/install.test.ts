/// <reference types="node" />
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/http/app';

const env = { API_KEY: 'test-key-0123456789abcdefghij', STORAGE_ADAPTER: 'in-memory' } as never;
const dir = mkdtempSync('/tmp/bm-install-');
const join = (...parts: string[]) => parts.join('/');

const fetchText = async (path: string) => {
  const res = await createApp().request(`https://bm.example${path}`, {}, env);
  expect(res.status).toBe(200);
  return res.text();
};

describe('codex installer', () => {
  it('serves a valid shell installer pointed at this origin, without auth', async () => {
    const sh = await fetchText('/install/codex.sh');
    expect(sh).toContain('BASE="https://bm.example"');
    expect(sh).not.toContain('__BASE__');
    const file = join(dir, 'install.sh');
    writeFileSync(file, sh);
    execFileSync('sh', ['-n', file]);
  });

  it('serves a hook script that compiles and stays quiet on unknown events', async () => {
    const py = await fetchText('/install/codex/baomemory_hook.py');
    const file = join(dir, 'baomemory_hook.py');
    writeFileSync(file, py);
    execFileSync('python3', ['-m', 'py_compile', file]);
    const out = execFileSync('python3', [file], { input: '{"hook_event_name":"PreToolUse"}' }).toString();
    expect(out).toBe('');
  });

  it('buffers prompts and replies per session', async () => {
    const file = join(dir, 'baomemory_hook.py');
    const run = (event: object) =>
      execFileSync('python3', [file], {
        input: JSON.stringify({ session_id: 's1', cwd: '/p', ...event }),
        env: { ...process.env, BAOMEMORY_URL: 'http://127.0.0.1:9' },
      }).toString();
    expect(run({ hook_event_name: 'UserPromptSubmit', prompt: 'hi' })).toBe('');
    expect(run({ hook_event_name: 'Stop', last_assistant_message: 'x'.repeat(500) })).toBe('{}\n');
    const log = execFileSync('cat', [join(dir, 'buffers', 's1.log')]).toString();
    expect(log).toBe(`用户: hi\nAI: ${'x'.repeat(400)}…\n`);
  });
});

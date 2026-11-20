import { describe, expect, it } from 'vitest';
import { createApp } from '../src/http/app';

const env = {
  API_KEY: 'test-key-0123456789abcdefghij',
  STORAGE_ADAPTER: 'in-memory',
  AI: { run: async () => ({}) },
} as never;

describe('http', () => {
  it('serves the admin page without auth and without secrets', async () => {
    const res = await createApp().request('/admin', {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('baomemory 后台');
    expect(html).not.toContain('test-key');
    // An on* handler returning false cancels the keystroke; inputs must use addEventListener.
    expect(html).not.toMatch(/\.on(key\w+|click|change)\s*=/);
    expect(html.match(/<\/script>/g)).toHaveLength(2);
  });

  it.each(['/v1/context', '/v1/memories', '/v1/export', '/v1/candidates', '/mcp'])(
    'rejects %s without a bearer token',
    async (path) => {
      const res = await createApp().request(path, {}, env);
      expect(res.status).toBe(401);
    },
  );

  it('queues imported entries for review over HTTP', async () => {
    const app = createApp();
    const auth = {
      authorization: 'Bearer test-key-0123456789abcdefghij',
      'content-type': 'application/json',
    };
    const res = await app.request(
      '/v1/import/entries',
      { method: 'POST', headers: auth, body: JSON.stringify({ text: '- [偏好] 喜欢冰美式 #饮品' }) },
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ parsed: 1, queued: 1 });
    const list = await app.request('/v1/candidates', { headers: auth }, env);
    expect(await list.json()).toMatchObject({
      total: 1,
      items: [{ content: '喜欢冰美式', kind: 'preference' }],
    });
  });
});

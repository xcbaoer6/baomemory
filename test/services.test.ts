import { describe, expect, it } from 'vitest';
import { DomainError } from '../src/core/errors';
import { makeServices } from './fakes';

describe('remember', () => {
  it('creates, then merges a near-duplicate instead of inserting', async () => {
    const { services, repo } = makeServices();
    const a = await services.remember({ content: 'Cloudflare 账号统一用 me@example.com' });
    const b = await services.remember({ content: 'Cloudflare 账号统一用 me@example.com。' });
    expect(a.action).toBe('created');
    expect(b.action).toBe('merged');
    expect(b.memory.id).toBe(a.memory.id);
    expect(await repo.list({ limit: 10 })).toHaveLength(1);
  });

  it('normalizes tags', async () => {
    const { services } = makeServices();
    const { memory } = await services.remember({ content: 'x project', tags: [' Repo ', 'repo', ''] });
    expect(memory.tags).toEqual(['repo']);
  });

  it.each([
    '密码：hunter2hunter2',
    'key sk-abcdefghijklmnopqrstuvwxyz123456',
    '卡号 4111 1111 1111 1111',
    '-----BEGIN OPENSSH PRIVATE KEY-----',
  ])('rejects secrets: %s', async (content) => {
    const { services } = makeServices();
    await expect(services.remember({ content })).rejects.toBeInstanceOf(DomainError);
  });
});

describe('recall', () => {
  it('ranks the relevant memory first and touches hits after the response', async () => {
    const { services, deferred } = makeServices();
    await services.remember({ content: 'Supabase 机房选在东京' });
    await services.remember({ content: '喜欢喝冰美式' });
    const [top] = await services.recall({ query: 'Supabase 机房' });
    expect(top?.content).toContain('东京');
    expect(deferred).toHaveLength(1);
  });
});

describe('context + compaction', () => {
  it('falls back to recent memories, then serves the digest after compaction', async () => {
    const { services } = makeServices();
    await services.remember({ content: 'repo-hub 部署在 acme/websites' });
    await services.remember({ content: '称呼用户为 Alex', tier: 1, importance: 5 });

    const before = await services.context();
    expect(before.text).toContain('核心');

    const report = await services.compact();
    expect(report.summarized).toBe(2);

    const after = await services.context();
    expect(after.text).toContain('摘要');
    expect(after.text).toContain('repo-hub');
  });
});

describe('manage', () => {
  it('forgets and reports missing ids', async () => {
    const { services } = makeServices();
    const { memory } = await services.remember({ content: 'temp' });
    await services.manage.forget(memory.id);
    await expect(services.manage.get(memory.id)).rejects.toMatchObject({ code: 'not_found' });
  });
});

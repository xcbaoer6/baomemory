import { describe, expect, it } from 'vitest';
import { parseFacts } from '../src/adapters/extractor/workers-ai.extractor';
import { formatEntry, parseEntries, parseEntryLine } from '../src/core/domain/entry-format';
import { makeServices } from './fakes';

describe('entry format', () => {
  it('parses metadata, tags, dates and list markers', () => {
    expect(parseEntryLine('- 2025-12-15 [偏好|核心|4] 喜欢冰美式 #饮品 #日常')).toEqual({
      content: '喜欢冰美式',
      kind: 'preference',
      tier: 1,
      importance: 4,
      tags: ['饮品', '日常'],
    });
    expect(parseEntryLine('* plain line')).toEqual({ content: 'plain line', tags: [] });
  });

  it('splits lists by line, paragraphs by blank line, and skips headings', () => {
    const items = parseEntries('# 导出\n\n- a 项\n- b 项\n\n一段话\n续一行\n\n');
    expect(items.map((e) => e.content)).toEqual(['a 项', 'b 项', '一段话 续一行']);
  });

  it('round-trips through formatEntry', () => {
    const m = {
      content: '数据库在东京',
      kind: 'decision' as const,
      tier: 2 as const,
      importance: 3,
      tags: ['baomemory'],
    };
    expect(parseEntryLine(formatEntry(m))).toEqual(m);
  });
});

describe('import service', () => {
  it('queues entries for review and rejects secrets', async () => {
    const { services, candidates, repo } = makeServices();
    const r = await services.imports.entries('- 喜欢冰美式\n- 密码：hunter2hunter2', 'review');
    expect(r).toMatchObject({ parsed: 2, queued: 1, created: 0 });
    expect(r.rejected).toHaveLength(1);
    expect(await candidates.count()).toBe(1);
    expect(await repo.list({ limit: 10 })).toHaveLength(0);
  });

  it('writes entries directly with dedupe', async () => {
    const { services } = makeServices();
    const r = await services.imports.entries(
      '- Cloudflare 账号统一用 me@example.com\n- Cloudflare 账号统一用 me@example.com。',
      'direct',
    );
    expect(r).toMatchObject({ created: 1, merged: 1 });
  });

  it('extracts chat facts into the queue with the title as source', async () => {
    const { services } = makeServices();
    const r = await services.imports.chat({ transcript: '用户: 我住在东京\nAI: 好的', title: '搬家' });
    expect(r).toEqual({ queued: 1, created: 0, merged: 0, dropped: 0 });
    const { items } = await services.review.list(10);
    expect(items[0]).toMatchObject({ content: '我住在东京', source: 'chat-import: 搬家' });
  });

  it('remembers chat facts directly in direct mode', async () => {
    const { services, repo } = makeServices();
    const r = await services.imports.chat({
      transcript: '用户: 我住在东京\nAI: 好',
      mode: 'direct',
      source: 'codex',
    });
    expect(r).toEqual({ queued: 0, created: 1, merged: 0, dropped: 0 });
    expect((await repo.list({ limit: 5 }))[0]).toMatchObject({ content: '我住在东京', source: 'codex' });
  });
});

describe('review service', () => {
  it('approves with edits into memory and removes from the queue', async () => {
    const { services, repo } = makeServices();
    await services.imports.entries('- 喜欢冰美式\n- 喜欢跑步', 'review');
    const { items } = await services.review.list(10);
    const [a, b] = items.map((c) => c.id) as [string, string];
    const r = await services.review.approve([a], { [a]: { content: '喜欢冰美式，不加糖', importance: 4 } });
    expect(r).toEqual({ created: 1, merged: 0, failed: [] });
    expect((await repo.list({ limit: 10 }))[0]).toMatchObject({
      content: '喜欢冰美式，不加糖',
      importance: 4,
    });
    await services.review.reject([b]);
    expect((await services.review.list(10)).total).toBe(0);
  });
});

describe('export service', () => {
  it('exports every page as re-importable markdown', async () => {
    const { services } = makeServices();
    for (let i = 0; i < 3; i++)
      await services.remember({ content: `记忆编号 ${'甲乙丙'[i]} 号`, tags: ['t'] });
    const md = await services.exportAll('md');
    const back = parseEntries(md);
    expect(back).toHaveLength(3);
    expect(back[0]?.tags).toEqual(['t']);
    const jsonl = await services.exportAll('jsonl');
    expect(jsonl.split('\n').map((l) => JSON.parse(l).content)).toHaveLength(3);
  });
});

describe('extractor output parsing', () => {
  it('tolerates fences and drops malformed items', () => {
    const raw =
      '```json\n[{"content":"用户住在东京","kind":"fact","importance":9,"tags":["城市"]},{"content":""},3]\n```';
    expect(parseFacts(raw, 10)).toEqual([
      { content: '用户住在东京', kind: 'fact', importance: 5, tags: ['城市'], evidence: null },
    ]);
    expect(parseFacts('没有', 10)).toEqual([]);
  });
});

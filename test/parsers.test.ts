import { describe, expect, it } from 'vitest';
import { PARSERS_JS } from '../src/http/admin/client/parsers';

interface Conv {
  title: string;
  date: string;
  messages: { role: string; text: string }[];
}
interface Parsers {
  parseExport(raw: string, name?: string): { kind: string; conversations: Conv[] };
  toChunks(c: Conv[], max: number): { title: string; transcript: string }[];
}
const P = new Function(`${PARSERS_JS}; return BMParsers;`)() as Parsers;

describe('browser parsers', () => {
  it('reads a ChatGPT export along the current branch', () => {
    const raw = JSON.stringify([
      {
        title: '旅行',
        create_time: 1735689600,
        current_node: 'c',
        mapping: {
          r: { message: null, parent: null },
          a: { parent: 'r', message: { author: { role: 'user' }, content: { parts: ['我在东京'] } } },
          x: { parent: 'a', message: { author: { role: 'assistant' }, content: { parts: ['旧分支'] } } },
          c: { parent: 'a', message: { author: { role: 'assistant' }, content: { parts: ['好的'] } } },
        },
      },
    ]);
    const { kind, conversations } = P.parseExport(raw);
    expect(kind).toBe('chatgpt');
    expect(conversations[0]).toEqual({
      title: '旅行',
      date: '2025-01-01',
      messages: [
        { role: 'user', text: '我在东京' },
        { role: 'assistant', text: '好的' },
      ],
    });
  });

  it('reads a Claude export', () => {
    const raw = JSON.stringify([
      {
        name: '工作',
        created_at: '2026-01-02T03:04:05Z',
        chat_messages: [
          { sender: 'human', text: '我做后端' },
          { sender: 'assistant', content: [{ type: 'text', text: '收到' }] },
        ],
      },
    ]);
    const { kind, conversations } = P.parseExport(raw);
    expect(kind).toBe('claude');
    expect(conversations[0]?.messages).toEqual([
      { role: 'user', text: '我做后端' },
      { role: 'assistant', text: '收到' },
    ]);
  });

  it('reads plain transcripts and chunks on message boundaries, clipping replies', () => {
    const { conversations } = P.parseExport(`用户: 第一句\n继续\nAI: ${'x'.repeat(1000)}`, 'note');
    expect(conversations[0]?.messages[0]).toEqual({ role: 'user', text: '第一句\n继续' });
    const chunks = P.toChunks(conversations, 200);
    expect(chunks[0]?.transcript).toBe('用户: 第一句\n继续');
    expect(chunks.every((c) => c.transcript.length <= 200)).toBe(true);
    expect(chunks.map((c) => c.transcript).join('')).toContain('…');
  });
});

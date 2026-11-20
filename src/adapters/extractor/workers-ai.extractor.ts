import { MEMORY_KINDS, type MemoryKind } from '../../core/domain/memory';
import { upstream } from '../../core/errors';
import type { ExtractedFact, Extractor } from '../../core/ports';
import type { AiRunner } from '../ai-runner';
import { type ChatOutput, chatText } from '../ai-text';

export interface WorkersAiExtractorOptions {
  readonly ai: AiRunner;
  readonly model?: string;
  readonly maxFacts?: number;
}

const SYSTEM_PROMPT = `你从用户与 AI 的聊天记录里提取“关于用户本人、值得长期记住”的事实。
只要：身份背景、长期偏好与习惯、重要的人、进行中的项目、做过的决定、重要事件。
不要：一次性的问题、AI 说的话、常识、代码细节、闲聊、对 AI 下的操作指令（如“存档”“记住”）、任何密码密钥卡号。
每条一句话，第三人称写“用户……”，简体中文，自包含（不依赖上下文也能看懂）。
只输出 JSON 数组，不要其他文字。每项：
{"content": "...", "kind": "fact|preference|decision|project|person|event|note", "importance": 1-5, "tags": ["..."], "evidence": "原文中最能支撑它的一小句"}
没有值得记的就输出 []。`;

const isKind = (k: unknown): k is MemoryKind =>
  typeof k === 'string' && (MEMORY_KINDS as readonly string[]).includes(k);
const clampInt = (n: unknown, lo: number, hi: number, dflt: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : dflt;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const toFact = (item: unknown): ExtractedFact | null => {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const content = str(o.content, 1000);
  if (content.length < 4) return null;
  return {
    content,
    kind: isKind(o.kind) ? o.kind : 'fact',
    importance: clampInt(o.importance, 1, 5, 3),
    tags: Array.isArray(o.tags)
      ? o.tags
          .map((t) => str(t, 40))
          .filter(Boolean)
          .slice(0, 8)
      : [],
    evidence: str(o.evidence, 300) || null,
  };
};

const jsonArray = (raw: string): unknown[] => {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start < 0 || end <= start) return [];
  try {
    const data: unknown = JSON.parse(raw.slice(start, end + 1));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

/** Tolerates prose or code fences around the array; drops malformed items instead of failing. */
export const parseFacts = (raw: string, maxFacts: number): ExtractedFact[] =>
  jsonArray(raw)
    .map(toFact)
    .filter((f): f is ExtractedFact => f !== null)
    .slice(0, maxFacts);

export class WorkersAiExtractor implements Extractor {
  readonly #ai: AiRunner;
  readonly #model: string;
  readonly #maxFacts: number;

  constructor({ ai, model = '@cf/zai-org/glm-4.7-flash', maxFacts = 20 }: WorkersAiExtractorOptions) {
    this.#ai = ai;
    this.#model = model;
    this.#maxFacts = maxFacts;
  }

  async extract({ transcript, title, date }: { transcript: string; title?: string; date?: string }) {
    const header = [title && `对话标题：${title}`, date && `日期：${date}`].filter(Boolean).join('\n');
    let out: ChatOutput;
    try {
      out = (await this.#ai.run(this.#model, {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `${header}\n\n聊天记录：\n${transcript}` },
        ],
        max_tokens: 2048,
        temperature: 0.1,
      })) as ChatOutput;
    } catch (cause) {
      throw upstream('workers-ai extractor', cause);
    }
    return parseFacts(chatText(out), this.#maxFacts);
  }
}

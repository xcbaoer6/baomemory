import type { Memory } from '../../core/domain/memory';
import { upstream } from '../../core/errors';
import type { Summarizer } from '../../core/ports';
import type { AiRunner } from '../ai-runner';
import { type ChatOutput, chatText } from '../ai-text';

export interface WorkersAiSummarizerOptions {
  readonly ai: AiRunner;
  readonly model?: string;
}

const SYSTEM_PROMPT = `你是记忆整理器。把关于用户的记忆条目整理成一份精简的核心摘要，供 AI 助手每次对话开始时阅读。
规则：
- 只写事实，不编造，不加评价。
- 按主题分组：身份与偏好、进行中的项目、近期决定、重要的人。
- 前后矛盾时以更新时间较新的为准。
- 去掉重复与琐碎内容，优先 importance 高的条目。
- 使用简体中文 Markdown 列表，不要标题以外的修饰。`;

const formatMemory = (m: Memory) =>
  `- [${m.kind}|重要度${m.importance}|${m.updatedAt.slice(0, 10)}] ${m.content}`;

export class WorkersAiSummarizer implements Summarizer {
  readonly #ai: AiRunner;
  readonly #model: string;

  constructor({ ai, model = '@cf/zai-org/glm-4.7-flash' }: WorkersAiSummarizerOptions) {
    this.#ai = ai;
    this.#model = model;
  }

  async summarize(memories: readonly Memory[], previous: string | null, maxChars: number) {
    const user = [
      previous ? `上一版摘要：\n${previous}` : null,
      `全部有效记忆（${memories.length} 条）：\n${memories.map(formatMemory).join('\n')}`,
      `请输出新的核心摘要，不超过 ${maxChars} 个字符。`,
    ]
      .filter(Boolean)
      .join('\n\n');

    let out: ChatOutput;
    try {
      out = (await this.#ai.run(this.#model, {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: user },
        ],
        max_tokens: 2048,
        temperature: 0.2,
      })) as ChatOutput;
    } catch (cause) {
      throw upstream('workers-ai summarizer', cause);
    }
    const text = chatText(out);
    if (!text) throw upstream('workers-ai summarizer: empty output');
    return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
  }
}

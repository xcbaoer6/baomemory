import { MEMORY_KINDS, type Memory, type MemoryKind, Tier } from './memory';

/**
 * One memory per line, readable and hand-editable, and round-trippable:
 *
 *   - [preference|核心|4] 喜欢冰美式 #饮品 #日常
 *
 * Inside the brackets every part is optional and order-free: a kind (English or
 * Chinese), a tier (核心/活跃/归档), an importance 1-5. A leading date
 * (2025-12-15) is accepted and ignored. Plain lines and paragraphs work too.
 */
export interface ParsedEntry {
  readonly content: string;
  readonly kind?: MemoryKind;
  readonly tier?: Tier;
  readonly importance?: number;
  readonly tags: string[];
}

const KIND_ALIASES: Record<string, MemoryKind> = {
  事实: 'fact',
  偏好: 'preference',
  决定: 'decision',
  项目: 'project',
  人物: 'person',
  事件: 'event',
  笔记: 'note',
};
const TIER_NAMES: Record<number, string> = {
  [Tier.Core]: '核心',
  [Tier.Active]: '活跃',
  [Tier.Archived]: '归档',
};
const TIER_ALIASES: Record<string, Tier> = { 核心: Tier.Core, 活跃: Tier.Active, 归档: Tier.Archived };
const isKind = (s: string): s is MemoryKind => (MEMORY_KINDS as readonly string[]).includes(s);

const TAG = /(?:^|\s)#([^\s#]{1,40})/g;
const LEADING = /^\s*(?:[-*•]|\d+[.)])\s+/;
const DATE = /^\d{4}-\d{2}-\d{2}\s+/;
const META = /^\[([^\]]{1,60})\]\s*/;

const parseMeta = (raw: string) => {
  const meta: { kind?: MemoryKind; tier?: Tier; importance?: number } = {};
  for (const part of raw.split(/[|,，/]/).map((p) => p.trim().toLowerCase())) {
    if (isKind(part)) meta.kind = part;
    else if (KIND_ALIASES[part]) meta.kind = KIND_ALIASES[part];
    else if (TIER_ALIASES[part]) meta.tier = TIER_ALIASES[part];
    else if (/^[1-5]$/.test(part)) meta.importance = Number(part);
  }
  return meta;
};

export const parseEntryLine = (line: string): ParsedEntry | null => {
  let rest = line.replace(LEADING, '').replace(DATE, '').trim();
  let meta = {};
  const m = META.exec(rest);
  if (m?.[1]) {
    meta = parseMeta(m[1]);
    rest = rest.slice(m[0].length);
  }
  const tags = [...rest.matchAll(TAG)].map((t) => t[1] as string);
  const content = rest.replace(TAG, '').replace(/\s+/g, ' ').trim();
  return content ? { content, tags, ...meta } : null;
};

/** Splits on lines; blank-line separated paragraphs without list markers become one entry each. */
export const parseEntries = (text: string): ParsedEntry[] => {
  const blocks = text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .flatMap((block) => (LEADING.test(block) ? block.split('\n') : [block.replace(/\n/g, ' ')]));
  return blocks
    .filter((b) => !/^\s*#{1,6}\s/.test(b)) // markdown headings are not memories
    .map(parseEntryLine)
    .filter((e): e is ParsedEntry => e !== null);
};

export const formatEntry = (m: Pick<Memory, 'content' | 'kind' | 'tier' | 'importance' | 'tags'>) => {
  const tags = m.tags.map((t) => ` #${t.replace(/\s+/g, '_')}`).join('');
  return `- [${m.kind}|${TIER_NAMES[m.tier]}|${m.importance}] ${m.content.replace(/\s*\n\s*/g, ' ')}${tags}`;
};

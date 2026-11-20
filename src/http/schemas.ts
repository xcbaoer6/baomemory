import { z } from '@hono/zod-openapi';
import { MEMORY_KINDS } from '../core/domain/memory';

const csv = z
  .string()
  .transform((s) =>
    s
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  )
  .optional();

export const MemorySchema = z
  .object({
    id: z.uuid(),
    content: z.string(),
    kind: z.enum(MEMORY_KINDS),
    tags: z.array(z.string()),
    tier: z.number().int().min(1).max(3),
    importance: z.number().int().min(1).max(5),
    source: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('Memory');

export const ScoredMemorySchema = MemorySchema.extend({
  similarity: z.number(),
  score: z.number(),
}).openapi('ScoredMemory');

export const RememberBodySchema = z
  .object({
    content: z.string().min(1).max(4000).openapi({ example: 'Cloudflare 账号统一用 me@example.com' }),
    kind: z.enum(MEMORY_KINDS).optional(),
    tags: z.array(z.string().max(40)).max(16).optional(),
    tier: z
      .union([z.literal(1), z.literal(2)])
      .optional()
      .openapi({ description: '1 = core, 2 = active' }),
    importance: z.number().int().min(1).max(5).optional(),
    source: z.string().max(200).optional(),
  })
  .openapi('RememberBody');

export const PatchBodySchema = RememberBodySchema.partial()
  .extend({ tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional() })
  .openapi('PatchBody');

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(50).default(8),
  tags: csv,
  archived: z.stringbool().default(false),
});

export const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  tags: csv,
  tier: z.coerce.number().int().min(1).max(3).optional(),
});

export const IdParamSchema = z.object({ id: z.uuid() });

export const ContextSchema = z
  .object({ text: z.string(), digestUpdatedAt: z.string().nullable(), core: z.array(MemorySchema) })
  .openapi('Context');

export const ErrorSchema = z
  .object({ error: z.object({ code: z.string(), message: z.string() }) })
  .openapi('Error');

export const CandidateSchema = z
  .object({
    id: z.uuid(),
    content: z.string(),
    kind: z.enum(MEMORY_KINDS),
    tags: z.array(z.string()),
    importance: z.number().int().min(1).max(5),
    source: z.string().nullable(),
    evidence: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi('Candidate');

export const ImportEntriesBodySchema = z
  .object({
    text: z.string().min(1).max(200_000).openapi({ example: '- [preference|核心|4] 喜欢冰美式 #饮品' }),
    mode: z.enum(['direct', 'review']).default('review'),
    source: z.string().max(100).optional(),
  })
  .openapi('ImportEntriesBody');

export const ImportChatBodySchema = z
  .object({
    transcript: z.string().min(1).max(12_000),
    mode: z.enum(['direct', 'review']).default('review'),
    title: z.string().max(200).optional(),
    date: z.string().max(40).optional(),
    source: z.string().max(100).optional(),
  })
  .openapi('ImportChatBody');

const Ids = z.array(z.uuid()).min(1).max(200);

export const ApproveBodySchema = z
  .object({
    ids: Ids,
    edits: z
      .record(
        z.string(),
        z.object({
          content: z.string().min(1).max(4000).optional(),
          kind: z.enum(MEMORY_KINDS).optional(),
          tags: z.array(z.string().max(40)).max(16).optional(),
          importance: z.number().int().min(1).max(5).optional(),
        }),
      )
      .optional(),
  })
  .openapi('ApproveBody');

export const RejectBodySchema = z.object({ ids: Ids }).openapi('RejectBody');

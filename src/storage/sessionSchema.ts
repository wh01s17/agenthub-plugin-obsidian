import { z } from 'zod';
import type { TranscriptItem } from '../core/types';

// IDs become filenames. Never accept path separators or traversal from persisted data.
export const localIdSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/);
export const sessionEntrySchema = z.object({
  localId: localIdSchema,
  agentId: z.string().min(1),
  nativeSessionId: z.string().optional(),
  title: z.string(),
  cwd: z.string(),
  createdAt: z.number().nonnegative(),
  updatedAt: z.number().nonnegative(),
});
export type SessionEntry = z.infer<typeof sessionEntrySchema>;

const kind = z.enum([
  'read',
  'edit',
  'delete',
  'move',
  'search',
  'execute',
  'think',
  'fetch',
  'other',
]);
const locations = z.array(z.object({ path: z.string(), line: z.number().optional() })).optional();
const tool = z.object({
  id: z.string(),
  title: z.string(),
  kind,
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
  rawInput: z.unknown().optional(),
  rawOutput: z.unknown().optional(),
  locations,
  content: z
    .array(
      z.discriminatedUnion('type', [
        z.object({ type: z.literal('text'), text: z.string() }),
        z.object({
          type: z.literal('diff'),
          path: z.string(),
          oldText: z.string().nullable(),
          newText: z.string(),
        }),
        z.object({
          type: z.literal('terminal'),
          output: z.string(),
          exitCode: z.number().optional(),
        }),
      ]),
    )
    .optional(),
});
const block = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({
    type: z.literal('file'),
    path: z.string(),
    absPath: z.string(),
    text: z.string().optional(),
  }),
  z.object({
    type: z.literal('selection'),
    path: z.string(),
    text: z.string(),
    fromLine: z.number(),
    toLine: z.number(),
  }),
  z.object({ type: z.literal('image'), mimeType: z.string(), data: z.string() }),
]);
const outcome = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('selected'), optionId: z.string() }),
  z.object({ outcome: z.literal('cancelled') }),
]);
const notice = z.discriminatedUnion('key', [
  z.object({
    key: z.literal('agentError'),
    message: z.string(),
    hint: z.string().optional(),
    detail: z.string().optional(),
  }),
  z.object({ key: z.literal('permissionDenied'), toolName: z.string() }),
  z.object({ key: z.literal('contextNotRestored') }),
  z.object({ key: z.literal('imagesNotSent') }),
  z.object({
    key: z.literal('turnStopped'),
    stopReason: z.enum(['max_tokens', 'max_turn_requests', 'refusal', 'cancelled', 'error']),
  }),
]);
const item: z.ZodType<TranscriptItem> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('user'), id: z.string(), blocks: z.array(block), at: z.number() }),
  z.object({
    kind: z.literal('assistant'),
    id: z.string(),
    text: z.string(),
    streaming: z.boolean(),
  }),
  z.object({
    kind: z.literal('thought'),
    id: z.string(),
    text: z.string(),
    streaming: z.boolean(),
  }),
  z.object({ kind: z.literal('tool'), call: tool }),
  z.object({
    kind: z.literal('plan'),
    entries: z.array(
      z.object({
        content: z.string(),
        status: z.enum(['pending', 'in_progress', 'completed']),
        priority: z.enum(['high', 'medium', 'low']).optional(),
      }),
    ),
  }),
  z.object({
    kind: z.literal('permission'),
    request: z.object({
      id: z.string(),
      toolCall: tool.pick({ id: true, title: true, kind: true, rawInput: true, locations: true }),
      options: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          kind: z.enum(['allow_once', 'allow_always', 'reject_once', 'reject_always']),
        }),
      ),
    }),
    resolved: outcome.optional(),
  }),
  z.object({
    kind: z.literal('notice'),
    id: z.string(),
    level: z.enum(['info', 'warning', 'error']),
    notice,
  }),
]);
export const transcriptRecordSchema = z.object({ v: z.literal(1), t: z.number(), item });

/** Disk snapshots have no live streaming or actionable permission request. */
export function consolidate(item: TranscriptItem): TranscriptItem {
  if (item.kind === 'assistant' || item.kind === 'thought') return { ...item, streaming: false };
  if (item.kind === 'permission' && !item.resolved)
    return { ...item, resolved: { outcome: 'cancelled' } };
  return item;
}

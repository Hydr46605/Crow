import { z } from 'zod';

/**
 * Common kinds of object an agent can annotate. The set is open: agents may use
 * any short lowercase type, but these cover Discord's usual targets.
 */
export const TARGET_TYPES = [
  'user',
  'member',
  'role',
  'channel',
  'thread',
  'message',
  'guild',
  'webhook',
  'emoji',
  'sticker',
  'invite',
] as const;

/** The kind of object a note describes (normalized to lowercase). */
export const noteTargetTypeSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .transform((value) => value.toLowerCase())
  .describe(
    `The kind of object the note is about: ${TARGET_TYPES.join(', ')}, or any custom type.`,
  );

/** The identifier of the object a note describes (a snowflake or a custom key). */
export const noteTargetIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .describe('The ID (snowflake or custom key) of the object the note is about.');

/** The note text itself. */
export const noteTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .describe('The note text (1-2000 characters).');

/** Optional short label; re-adding a note with the same key updates it in place. */
export const noteKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .optional()
  .describe('Optional short label; adding a note with the same key updates it instead of appending.');

/**
 * A single informational note attached to a Discord object, persisted locally
 * so any agent (or a later session) can recover context.
 */
export const noteSchema = z.object({
  id: z.string().min(1),
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  key: z.string().min(1).optional(),
  text: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type Note = z.infer<typeof noteSchema>;

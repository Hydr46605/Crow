import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import {
  noteKeySchema,
  noteTargetIdSchema,
  noteTargetTypeSchema,
  noteTextSchema,
} from '../notes/types.js';
import { IDEMPOTENT, READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { errorResult, textResult } from './result.js';

const addNoteInput = z.object({
  targetType: noteTargetTypeSchema,
  targetId: noteTargetIdSchema,
  text: noteTextSchema,
  key: noteKeySchema,
});

const listNotesInput = z.object({
  targetType: noteTargetTypeSchema.optional(),
  targetId: noteTargetIdSchema.optional(),
  query: z
    .string()
    .max(200)
    .optional()
    .describe('Case-insensitive text search across note text and keys.'),
});

const removeNoteInput = z.object({
  noteId: z.string().min(1).max(64).describe('The ID of the note to remove.'),
});

const clearNotesInput = z.object({
  targetType: noteTargetTypeSchema,
  targetId: noteTargetIdSchema,
});

export type AddNoteArgs = z.infer<typeof addNoteInput>;
export type ListNotesArgs = z.infer<typeof listNotesInput>;
export type RemoveNoteArgs = z.infer<typeof removeNoteInput>;
export type ClearNotesArgs = z.infer<typeof clearNotesInput>;

export const addNote = async (args: AddNoteArgs, ctx: CrowContext): Promise<CallToolResult> => {
  const result = await attempt('add_note', async () => ctx.notes.add(args));
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value, null, 2));
};

export const listNotes = async (args: ListNotesArgs, ctx: CrowContext): Promise<CallToolResult> => {
  const result = await attempt('list_notes', async () => ctx.notes.list(args));
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value, null, 2));
};

export const removeNote = async (
  args: RemoveNoteArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('remove_note', async () => ctx.notes.remove(args.noteId));
  if (!result.ok) return errorResult(result.error);
  return textResult(result.value ? `Removed note ${args.noteId}.` : `No note with ID ${args.noteId}.`);
};

export const clearNotes = async (
  args: ClearNotesArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('clear_notes', async () =>
    ctx.notes.clear(args.targetType, args.targetId),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(
    result.value > 0
      ? `Removed ${result.value} note(s) for ${args.targetType} ${args.targetId}.`
      : `No notes for ${args.targetType} ${args.targetId}.`,
  );
};

export const registerNoteTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'add_note',
    {
      title: 'Add note',
      description:
        'Attach a local informational note to a Discord object (user, member, role, channel, message, ' +
        'guild, webhook, or any custom type). Notes persist across sessions and are shared with other ' +
        'agents, so record context you will want to recall later. Add a "key" to update a note in place ' +
        'instead of appending a duplicate.',
      inputSchema: addNoteInput,
      annotations: IDEMPOTENT,
    },
    async (args) => addNote(args, ctx),
  );
  server.registerTool(
    'list_notes',
    {
      title: 'List notes',
      description:
        'List local notes, optionally filtered by object type, object ID, or a text search. Use this ' +
        'to recall context that you or another agent recorded about a guild, channel, user, or other object.',
      inputSchema: listNotesInput,
      annotations: READ_ONLY,
    },
    async (args) => listNotes(args, ctx),
  );
  server.registerTool(
    'remove_note',
    {
      title: 'Remove note',
      description: 'Remove a single local note by its ID.',
      inputSchema: removeNoteInput,
      annotations: IDEMPOTENT,
    },
    async (args) => removeNote(args, ctx),
  );
  server.registerTool(
    'clear_notes',
    {
      title: 'Clear notes',
      description: 'Remove every local note attached to a single object.',
      inputSchema: clearNotesInput,
      annotations: IDEMPOTENT,
    },
    async (args) => clearNotes(args, ctx),
  );
};

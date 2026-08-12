import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { DESTRUCTIVE, IDEMPOTENT, READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { componentsSchema, normalizeComponents } from './components.js';
import { requireConsent } from './consent.js';
import { embedsSchema, normalizeEmbeds } from './embeds.js';
import { errorResult, textResult } from './result.js';
import { allowedMentionsSchema, consent, normalizeAllowedMentions, snowflake } from './schemas.js';

const readMessagesInput = {
  channelId: snowflake.describe('The ID of the channel to read messages from.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of messages to return (1-100).'),
  before: snowflake.optional().describe('Return messages before this message ID.'),
  after: snowflake.optional().describe('Return messages after this message ID.'),
  around: snowflake.optional().describe('Return messages around this message ID.'),
};

const sendMessageInput = z
  .object({
    channelId: snowflake.describe('The ID of the channel to send the message to.'),
    content: z
      .string()
      .min(1)
      .max(2000)
      .optional()
      .describe('The message content (1-2000 characters).'),
    embeds: embedsSchema.optional(),
    components: componentsSchema.optional(),
    allowedMentions: allowedMentionsSchema,
    tts: z.boolean().optional().describe('Whether this is a text-to-speech message.'),
    replyTo: snowflake.optional().describe('The ID of the message to reply to.'),
  })
  .superRefine((args, ctx) => {
    if (!args.content && !args.embeds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide "content", "embeds", or both.',
      });
    }
  });

const editMessageInput = z
  .object({
    channelId: snowflake.describe('The ID of the channel containing the message.'),
    messageId: snowflake.describe('The ID of the message to edit.'),
    content: z
      .string()
      .min(1)
      .max(2000)
      .optional()
      .describe('The new message content (1-2000 characters).'),
    embeds: embedsSchema.optional(),
    components: componentsSchema.optional(),
  })
  .superRefine((args, ctx) => {
    if (!args.content && !args.embeds && !args.components) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one of "content", "embeds", or "components".',
      });
    }
  });

const deleteMessageInput = {
  channelId: snowflake.describe('The ID of the channel containing the message.'),
  messageId: snowflake.describe('The ID of the message to delete.'),
  confirm: consent,
};

export interface ReadMessagesArgs {
  readonly channelId: string;
  readonly limit?: number;
  readonly before?: string;
  readonly after?: string;
  readonly around?: string;
}

export type SendMessageArgs = z.infer<typeof sendMessageInput>;
export type EditMessageArgs = z.infer<typeof editMessageInput>;

export interface DeleteMessageArgs {
  readonly channelId: string;
  readonly messageId: string;
  readonly confirm?: true;
}

interface RawMessage {
  readonly id: string;
  readonly channel_id: string;
  readonly author: { readonly id: string; readonly username: string };
  readonly content: string;
  readonly timestamp: string;
}

export interface MessageSummary {
  readonly id: string;
  readonly channelId: string;
  readonly authorId: string;
  readonly authorUsername: string;
  readonly content: string;
  readonly createdAt: string;
}

export const summarizeMessage = (message: RawMessage): MessageSummary => ({
  id: message.id,
  channelId: message.channel_id,
  authorId: message.author.id,
  authorUsername: message.author.username,
  content: message.content,
  createdAt: message.timestamp,
});

export const readMessages = async (
  args: ReadMessagesArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const query = {
    limit: args.limit,
    before: args.before,
    after: args.after,
    around: args.around,
  };

  const result = await attempt('read_messages', () =>
    ctx.discord.request<RawMessage[]>('GET', `/channels/${args.channelId}/messages`, { query }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.map(summarizeMessage), null, 2));
};

export const sendMessage = async (
  args: SendMessageArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = {};
  if (args.content !== undefined) body.content = args.content;
  if (args.embeds) body.embeds = normalizeEmbeds(args.embeds);
  if (args.components) body.components = normalizeComponents(args.components);
  if (args.allowedMentions) body.allowed_mentions = normalizeAllowedMentions(args.allowedMentions);
  if (args.tts !== undefined) body.tts = args.tts;
  if (args.replyTo) body.message_reference = { message_id: args.replyTo };

  const result = await attempt('send_message', () =>
    ctx.discord.request<RawMessage>('POST', `/channels/${args.channelId}/messages`, { body }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeMessage(result.value), null, 2));
};

export const editMessage = async (
  args: EditMessageArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = {};
  if (args.content !== undefined) body.content = args.content;
  if (args.embeds) body.embeds = normalizeEmbeds(args.embeds);
  if (args.components) body.components = normalizeComponents(args.components);

  const result = await attempt('edit_message', () =>
    ctx.discord.request<RawMessage>(
      'PATCH',
      `/channels/${args.channelId}/messages/${args.messageId}`,
      { body },
    ),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeMessage(result.value), null, 2));
};

export const deleteMessage = async (
  args: DeleteMessageArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const gate = requireConsent(args.confirm);
  if (gate) return gate;

  const result = await attempt('delete_message', () =>
    ctx.discord.request<unknown>(
      'DELETE',
      `/channels/${args.channelId}/messages/${args.messageId}`,
    ),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Deleted message ${args.messageId}.`);
};

export const registerMessageTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'read_messages',
    {
      title: 'Read messages',
      description:
        'Read recent messages from a Discord channel, with optional pagination via before/after/around.',
      inputSchema: readMessagesInput,
      annotations: READ_ONLY,
    },
    async (args) => readMessages(args, ctx),
  );
  server.registerTool(
    'send_message',
    {
      title: 'Send message',
      description:
        'Send a message to a Discord channel with content, embeds, and/or components ' +
        '(buttons, select menus). Optionally reply to a message, set allowed mentions, or use TTS.',
      inputSchema: sendMessageInput,
    },
    async (args) => sendMessage(args, ctx),
  );
  server.registerTool(
    'edit_message',
    {
      title: 'Edit message',
      description: 'Edit a message: content, embeds, and/or components.',
      inputSchema: editMessageInput,
      annotations: IDEMPOTENT,
    },
    async (args) => editMessage(args, ctx),
  );
  server.registerTool(
    'delete_message',
    {
      title: 'Delete message',
      description: 'Delete a message. Requires explicit consent ("confirm": true).',
      inputSchema: deleteMessageInput,
      annotations: DESTRUCTIVE,
    },
    async (args) => deleteMessage(args, ctx),
  );
};

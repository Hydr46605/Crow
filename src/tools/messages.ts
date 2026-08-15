import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import type { DiscordFile } from '../discord/client.js';
import { fileSourceShape, MAX_ATTACHMENT_BYTES, requireSingleFileSource, resolveFile } from '../files.js';
import { DESTRUCTIVE, IDEMPOTENT, READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { componentsSchema, normalizeComponents, type ComponentsInput } from './components.js';
import { requireConsent } from './consent.js';
import { embedsSchema, normalizeEmbeds, type EmbedInput } from './embeds.js';
import { errorResult, textResult } from './result.js';
import { allowedMentionsSchema, consent, normalizeAllowedMentions, snowflake, type AllowedMentionsInput } from './schemas.js';

const attachmentSchema = fileSourceShape
  .extend({
    description: z.string().max(1024).optional().describe('Alt text for the attachment.'),
  })
  .superRefine(requireSingleFileSource);

export const attachmentsSchema = z
  .array(attachmentSchema)
  .min(1)
  .max(10)
  .describe('Up to 10 file attachments.');

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
    attachments: attachmentsSchema.optional(),
    allowedMentions: allowedMentionsSchema,
    tts: z.boolean().optional().describe('Whether this is a text-to-speech message.'),
    replyTo: snowflake.optional().describe('The ID of the message to reply to.'),
  })
  .superRefine((args, ctx) => {
    if (!args.content && !args.embeds && !args.attachments) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide "content", "embeds", "attachments", or a combination.',
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
    attachments: attachmentsSchema.optional(),
  })
  .superRefine((args, ctx) => {
    if (!args.content && !args.embeds && !args.components && !args.attachments) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one of "content", "embeds", "components", or "attachments".',
      });
    }
  });

const deleteMessageInput = {
  channelId: snowflake.describe('The ID of the channel containing the message.'),
  messageId: snowflake.describe('The ID of the message to delete.'),
  confirm: consent,
};

const pinMessageInput = {
  channelId: snowflake.describe('The ID of the channel containing the message.'),
  messageId: snowflake.describe('The ID of the message to pin.'),
};

const unpinMessageInput = {
  channelId: snowflake.describe('The ID of the channel containing the message.'),
  messageId: snowflake.describe('The ID of the message to unpin.'),
};

const bulkDeleteMessagesInput = {
  channelId: snowflake.describe('The ID of the channel to bulk-delete messages in.'),
  messageIds: z
    .array(snowflake)
    .min(2)
    .max(100)
    .describe('2-100 message IDs to delete (all must be under 14 days old).'),
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

export interface PinMessageArgs {
  readonly channelId: string;
  readonly messageId: string;
}

export interface BulkDeleteMessagesArgs {
  readonly channelId: string;
  readonly messageIds: readonly string[];
  readonly confirm?: true;
}

export interface RawMessage {
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

const resolveAttachments = async (
  attachments: readonly { name?: string; path?: string; url?: string; data?: string }[],
): Promise<DiscordFile[]> => {
  const files: DiscordFile[] = [];
  for (const attachment of attachments) {
    const resolved = await resolveFile(attachment, MAX_ATTACHMENT_BYTES);
    files.push({ name: resolved.name, data: resolved.data, contentType: resolved.contentType });
  }
  return files;
};

const attachmentsBody = (
  attachments: readonly { description?: string }[],
  files: readonly DiscordFile[],
): { id: number; filename?: string; description?: string }[] =>
  attachments.map((attachment, index) => ({
    id: index,
    filename: files[index]?.name,
    description: attachment.description,
  }));

/** A message attachment, resolved to bytes and referenced by index in the body. */
export interface MessageAttachmentInput {
  readonly name?: string;
  readonly path?: string;
  readonly url?: string;
  readonly data?: string;
  readonly description?: string;
}

/** The shared message-content fields used by send_message, edit_message, and send_dm. */
export interface BuildMessageBodyArgs {
  readonly content?: string;
  readonly embeds?: EmbedInput[];
  readonly components?: ComponentsInput;
  readonly attachments?: readonly MessageAttachmentInput[];
  readonly allowedMentions?: AllowedMentionsInput;
  readonly tts?: boolean;
  readonly replyTo?: string;
}

/**
 * Builds a Discord message body plus its multipart files from the shared
 * message fields. Used by the messaging and DM tools so their payloads stay
 * identical.
 */
export const buildMessageBody = async (
  args: BuildMessageBodyArgs,
): Promise<{ body: Record<string, unknown>; files: DiscordFile[] }> => {
  const files = args.attachments ? await resolveAttachments(args.attachments) : [];

  const body: Record<string, unknown> = {};
  if (args.content !== undefined) body.content = args.content;
  if (args.embeds) body.embeds = normalizeEmbeds(args.embeds);
  if (args.components) body.components = normalizeComponents(args.components);
  if (args.allowedMentions) body.allowed_mentions = normalizeAllowedMentions(args.allowedMentions);
  if (args.tts !== undefined) body.tts = args.tts;
  if (args.replyTo) body.message_reference = { message_id: args.replyTo };
  if (args.attachments) body.attachments = attachmentsBody(args.attachments, files);
  return { body, files };
};

export interface FetchMessagesQuery {
  readonly limit?: number;
  readonly before?: string;
  readonly after?: string;
  readonly around?: string;
}

/** Fetches raw messages from a channel, shared by read_messages and read_dm_messages. */
export const fetchMessages = (
  channelId: string,
  query: FetchMessagesQuery,
  ctx: CrowContext,
): Promise<RawMessage[]> => {
  const params: Record<string, string | number | boolean | undefined> = {
    limit: query.limit,
    before: query.before,
    after: query.after,
    around: query.around,
  };
  return ctx.discord.request<RawMessage[]>('GET', `/channels/${channelId}/messages`, { query: params });
};

export const readMessages = async (
  args: ReadMessagesArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const query: FetchMessagesQuery = {
    limit: args.limit,
    before: args.before,
    after: args.after,
    around: args.around,
  };

  const result = await attempt('read_messages', () => fetchMessages(args.channelId, query, ctx));
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.map(summarizeMessage), null, 2));
};

export const sendMessage = async (
  args: SendMessageArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('send_message', async () => {
    const { body, files } = await buildMessageBody({
      content: args.content,
      embeds: args.embeds,
      components: args.components,
      attachments: args.attachments,
      allowedMentions: args.allowedMentions,
      tts: args.tts,
      replyTo: args.replyTo,
    });

    return ctx.discord.request<RawMessage>('POST', `/channels/${args.channelId}/messages`, {
      body,
      files: files.length > 0 ? files : undefined,
    });
  });
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeMessage(result.value), null, 2));
};

export const editMessage = async (
  args: EditMessageArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('edit_message', async () => {
    const { body, files } = await buildMessageBody({
      content: args.content,
      embeds: args.embeds,
      components: args.components,
      attachments: args.attachments,
    });

    return ctx.discord.request<RawMessage>(
      'PATCH',
      `/channels/${args.channelId}/messages/${args.messageId}`,
      { body, files: files.length > 0 ? files : undefined },
    );
  });
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

export const pinMessage = async (
  args: PinMessageArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('pin_message', () =>
    ctx.discord.request<unknown>('PUT', `/channels/${args.channelId}/pins/${args.messageId}`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Pinned message ${args.messageId}.`);
};

export const unpinMessage = async (
  args: PinMessageArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('unpin_message', () =>
    ctx.discord.request<unknown>('DELETE', `/channels/${args.channelId}/pins/${args.messageId}`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Unpinned message ${args.messageId}.`);
};

export const bulkDeleteMessages = async (
  args: BulkDeleteMessagesArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const gate = requireConsent(args.confirm);
  if (gate) return gate;

  const result = await attempt('bulk_delete_messages', () =>
    ctx.discord.request<unknown>('POST', `/channels/${args.channelId}/messages/bulk-delete`, {
      body: { messages: args.messageIds },
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Deleted ${args.messageIds.length} messages.`);
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
        'Send a message to a Discord channel with content, embeds, components (buttons, select ' +
        'menus), and/or file attachments. Optionally reply to a message, set allowed mentions, or use TTS.',
      inputSchema: sendMessageInput,
    },
    async (args) => sendMessage(args, ctx),
  );
  server.registerTool(
    'edit_message',
    {
      title: 'Edit message',
      description: 'Edit a message: content, embeds, components, and/or attachments.',
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
  server.registerTool(
    'pin_message',
    {
      title: 'Pin message',
      description: 'Pin a message in a channel.',
      inputSchema: pinMessageInput,
      annotations: IDEMPOTENT,
    },
    async (args) => pinMessage(args, ctx),
  );
  server.registerTool(
    'unpin_message',
    {
      title: 'Unpin message',
      description: 'Unpin a message in a channel.',
      inputSchema: unpinMessageInput,
      annotations: IDEMPOTENT,
    },
    async (args) => unpinMessage(args, ctx),
  );
  server.registerTool(
    'bulk_delete_messages',
    {
      title: 'Bulk delete messages',
      description:
        'Delete up to 100 messages at once (all under 14 days old). Requires explicit consent ("confirm": true).',
      inputSchema: bulkDeleteMessagesInput,
      annotations: DESTRUCTIVE,
    },
    async (args) => bulkDeleteMessages(args, ctx),
  );
};

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { IDEMPOTENT, READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { componentsSchema, isComponentsV2 } from './components.js';
import { embedsSchema } from './embeds.js';
import {
  attachmentsSchema,
  buildMessageBody,
  fetchMessages,
  summarizeMessage,
  type RawMessage,
} from './messages.js';
import { errorResult, textResult } from './result.js';
import { allowedMentionsSchema, snowflake } from './schemas.js';

const sendDmInput = z
  .object({
    userId: snowflake.describe('The ID of the user to send a direct message to.'),
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
  })
  .superRefine((args, ctx) => {
    if (!args.content && !args.embeds && !args.components && !args.attachments) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide "content", "embeds", "components", "attachments", or a combination.',
      });
    }
    if (args.components && isComponentsV2(args.components) && (args.content !== undefined || args.embeds !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Components V2 messages cannot include "content" or "embeds".',
      });
    }
  });

export type SendDmArgs = z.infer<typeof sendDmInput>;

interface RawDmChannel {
  readonly id: string;
  readonly type: number;
  readonly recipients?: readonly {
    readonly id: string;
    readonly username: string;
    readonly global_name?: string | null;
  }[];
  readonly last_message_id?: string | null;
}

export interface DmChannelSummary {
  readonly id: string;
  readonly type: number;
  readonly typeName: 'dm' | 'groupDm';
  readonly recipients: { readonly id: string; readonly username: string; readonly globalName: string | null }[];
  readonly lastMessageId?: string | null;
}

export const summarizeDmChannel = (channel: RawDmChannel): DmChannelSummary => ({
  id: channel.id,
  type: channel.type,
  typeName: channel.type === 3 ? 'groupDm' : 'dm',
  recipients: (channel.recipients ?? []).map((recipient) => ({
    id: recipient.id,
    username: recipient.username,
    globalName: recipient.global_name ?? null,
  })),
  lastMessageId: channel.last_message_id,
});

export const listDmChannels = async (ctx: CrowContext): Promise<CallToolResult> => {
  const result = await attempt('list_dm_channels', () =>
    ctx.discord.request<RawDmChannel[]>('GET', '/users/@me/channels'),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.map(summarizeDmChannel), null, 2));
};

/** Resolves (or creates) the DM channel with a user. */
const resolveDmChannel = async (ctx: CrowContext, userId: string): Promise<RawDmChannel> =>
  ctx.discord.request<RawDmChannel>('POST', '/users/@me/channels', { body: { recipient_id: userId } });

const readDmMessagesInput = z
  .object({
    userId: snowflake.optional().describe('The ID of the user whose DM to read.'),
    channelId: snowflake.optional().describe('The ID of the DM channel to read.'),
    limit: z.number().int().min(1).max(100).optional().describe('Maximum number of messages (1-100).'),
    before: snowflake.optional().describe('Return messages before this message ID.'),
    after: snowflake.optional().describe('Return messages after this message ID.'),
    around: snowflake.optional().describe('Return messages around this message ID.'),
  })
  .superRefine((args, ctx) => {
    if (!args.userId && !args.channelId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Provide "userId" or "channelId".' });
    }
    if (args.userId && args.channelId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Provide only one of "userId" or "channelId".' });
    }
    const anchors = [args.before, args.after, args.around].filter((value) => value !== undefined).length;
    if (anchors > 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Provide only one of "before", "after", or "around".' });
    }
  });

export type ReadDmMessagesArgs = z.infer<typeof readDmMessagesInput>;

export const getDmChannel = async (
  args: { readonly userId: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('get_dm_channel', async () => resolveDmChannel(ctx, args.userId));
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeDmChannel(result.value), null, 2));
};

export const readDmMessages = async (
  args: ReadDmMessagesArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('read_dm_messages', async () => {
    const channelId = args.channelId ?? (await resolveDmChannel(ctx, args.userId as string)).id;
    return fetchMessages(
      channelId,
      { limit: args.limit, before: args.before, after: args.after, around: args.around },
      ctx,
    );
  });
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.map(summarizeMessage), null, 2));
};

export const sendDm = async (args: SendDmArgs, ctx: CrowContext): Promise<CallToolResult> => {
  const result = await attempt('send_dm', async () => {
    const channel = await ctx.discord.request<RawDmChannel>('POST', '/users/@me/channels', {
      body: { recipient_id: args.userId },
    });

    const { body, files } = await buildMessageBody({
      content: args.content,
      embeds: args.embeds,
      components: args.components,
      attachments: args.attachments,
      allowedMentions: args.allowedMentions,
      tts: args.tts,
    });

    return ctx.discord.request<RawMessage>('POST', `/channels/${channel.id}/messages`, {
      body,
      files: files.length > 0 ? files : undefined,
    });
  });
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeMessage(result.value), null, 2));
};

export const registerDmTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'list_dm_channels',
    {
      title: 'List DM channels',
      description: "List the bot's direct message channels, with their recipients.",
      annotations: READ_ONLY,
    },
    async () => listDmChannels(ctx),
  );
  server.registerTool(
    'send_dm',
    {
      title: 'Send DM',
      description:
        'Send a direct message to a user (creating the DM channel if needed), with content, ' +
        'embeds, components, and/or file attachments.',
      inputSchema: sendDmInput,
    },
    async (args) => sendDm(args, ctx),
  );
  server.registerTool(
    'get_dm_channel',
    {
      title: 'Get DM channel',
      description: 'Resolve (or create) the direct message channel with a user and return its details.',
      inputSchema: { userId: snowflake.describe('The ID of the user.') },
      annotations: IDEMPOTENT,
    },
    async (args) => getDmChannel(args, ctx),
  );
  server.registerTool(
    'read_dm_messages',
    {
      title: 'Read DM messages',
      description: 'Read the message history of a direct message, by user or channel ID.',
      inputSchema: readDmMessagesInput,
      annotations: READ_ONLY,
    },
    async (args) => readDmMessages(args, ctx),
  );
};

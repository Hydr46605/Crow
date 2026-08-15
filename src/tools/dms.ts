import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { componentsSchema } from './components.js';
import { embedsSchema } from './embeds.js';
import { attachmentsSchema, buildMessageBody, summarizeMessage, type RawMessage } from './messages.js';
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
    if (!args.content && !args.embeds && !args.attachments) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide "content", "embeds", "attachments", or a combination.',
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
};

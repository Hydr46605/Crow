import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { DESTRUCTIVE, IDEMPOTENT, READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import {
  componentsSchema,
  COMPONENTS_V2_FLAG,
  isComponentsV2,
  normalizeComponents,
} from './components.js';
import { requireConsent } from './consent.js';
import { embedsSchema, normalizeEmbeds } from './embeds.js';
import { errorResult, textResult } from './result.js';
import { allowedMentionsSchema, consent, normalizeAllowedMentions, snowflake } from './schemas.js';

const listWebhooksInput = {
  channelId: snowflake.describe('The ID of the channel whose webhooks to list.'),
};

const getWebhookInput = {
  webhookId: snowflake.describe('The ID of the webhook to fetch.'),
};

const createWebhookInput = {
  channelId: snowflake.describe('The ID of the channel to create the webhook in.'),
  name: z.string().min(2).max(80).describe('Webhook name (2-80 characters).'),
  avatar: z
    .string()
    .optional()
    .describe('Base64-encoded avatar image as a data URI (e.g. data:image/png;base64,...).'),
};

const modifyWebhookInput = {
  webhookId: snowflake.describe('The ID of the webhook to modify.'),
  name: z.string().min(2).max(80).optional().describe('New webhook name (2-80 characters).'),
  avatar: z.string().optional().describe('New base64-encoded avatar data URI.'),
  channelId: snowflake.optional().describe('The channel to move the webhook to.'),
};

const deleteWebhookInput = {
  webhookId: snowflake.describe('The ID of the webhook to delete.'),
  confirm: consent,
};

export const executeWebhookInput = z
  .object({
    webhookId: snowflake.describe('The ID of the webhook to execute.'),
    webhookToken: z.string().min(1).describe('The webhook token (from get_webhook or create_webhook).'),
    content: z.string().max(2000).optional().describe('Message content (up to 2000 characters).'),
    username: z.string().min(1).max(80).optional().describe('Override the username the message posts as.'),
    avatarUrl: z.string().url().optional().describe('Override the avatar shown on the message.'),
    tts: z.boolean().optional().describe('Whether this is a text-to-speech message.'),
    embeds: embedsSchema.optional(),
    components: componentsSchema.optional(),
    allowedMentions: allowedMentionsSchema,
    threadId: snowflake.optional().describe('Send to this thread within the channel.'),
    wait: z
      .boolean()
      .optional()
      .describe('Wait for the message to be created and return it (defaults to false).'),
  })
  .superRefine((args, ctx) => {
    if (!args.content && !args.embeds && !args.components) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one of "content", "embeds", or "components".',
      });
    }
    if (args.components && isComponentsV2(args.components) && (args.content !== undefined || args.embeds !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Components V2 messages cannot include "content" or "embeds".',
      });
    }
  });

export interface ListWebhooksArgs {
  readonly channelId: string;
}
export interface GetWebhookArgs {
  readonly webhookId: string;
}
export interface CreateWebhookArgs {
  readonly channelId: string;
  readonly name: string;
  readonly avatar?: string;
}
export interface ModifyWebhookArgs {
  readonly webhookId: string;
  readonly name?: string;
  readonly avatar?: string;
  readonly channelId?: string;
}
export interface DeleteWebhookArgs {
  readonly webhookId: string;
  readonly confirm?: true;
}
export type ExecuteWebhookArgs = z.infer<typeof executeWebhookInput>;

interface RawWebhook {
  readonly id: string;
  readonly type: number;
  readonly guild_id?: string;
  readonly channel_id?: string;
  readonly name?: string;
  readonly avatar?: string | null;
  readonly token?: string;
}

export interface WebhookSummary {
  readonly id: string;
  readonly name?: string;
  readonly type: number;
  readonly guildId?: string;
  readonly channelId?: string;
  readonly avatar?: string | null;
  readonly token?: string;
}

export const summarizeWebhook = (webhook: RawWebhook): WebhookSummary => ({
  id: webhook.id,
  name: webhook.name,
  type: webhook.type,
  guildId: webhook.guild_id,
  channelId: webhook.channel_id,
  avatar: webhook.avatar,
  token: webhook.token,
});

export const listWebhooks = async (
  args: ListWebhooksArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('list_webhooks', () =>
    ctx.discord.request<RawWebhook[]>('GET', `/channels/${args.channelId}/webhooks`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.map(summarizeWebhook), null, 2));
};

export const getWebhook = async (
  args: GetWebhookArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('get_webhook', () =>
    ctx.discord.request<RawWebhook>('GET', `/webhooks/${args.webhookId}`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeWebhook(result.value), null, 2));
};

export const createWebhook = async (
  args: CreateWebhookArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = { name: args.name };
  if (args.avatar !== undefined) body.avatar = args.avatar;

  const result = await attempt('create_webhook', () =>
    ctx.discord.request<RawWebhook>('POST', `/channels/${args.channelId}/webhooks`, { body }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeWebhook(result.value), null, 2));
};

export const modifyWebhook = async (
  args: ModifyWebhookArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = {};
  if (args.name !== undefined) body.name = args.name;
  if (args.avatar !== undefined) body.avatar = args.avatar;
  if (args.channelId !== undefined) body.channel_id = args.channelId;

  const result = await attempt('modify_webhook', () =>
    ctx.discord.request<RawWebhook>('PATCH', `/webhooks/${args.webhookId}`, { body }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeWebhook(result.value), null, 2));
};

export const deleteWebhook = async (
  args: DeleteWebhookArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const gate = requireConsent(args.confirm);
  if (gate) return gate;

  const result = await attempt('delete_webhook', () =>
    ctx.discord.request<unknown>('DELETE', `/webhooks/${args.webhookId}`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Deleted webhook ${args.webhookId}.`);
};

export const executeWebhook = async (
  args: ExecuteWebhookArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = {};
  if (args.content !== undefined) body.content = args.content;
  if (args.username !== undefined) body.username = args.username;
  if (args.avatarUrl !== undefined) body.avatar_url = args.avatarUrl;
  if (args.tts !== undefined) body.tts = args.tts;
  if (args.embeds) body.embeds = normalizeEmbeds(args.embeds);
  if (args.components) {
    body.components = normalizeComponents(args.components);
    if (isComponentsV2(args.components)) body.flags = COMPONENTS_V2_FLAG;
  }
  if (args.allowedMentions) body.allowed_mentions = normalizeAllowedMentions(args.allowedMentions);

  const query: Record<string, string | number | boolean | undefined> = {
    wait: args.wait,
    thread_id: args.threadId,
  };
  if (args.components) query.with_components = true;

  const result = await attempt('execute_webhook', () =>
    ctx.discord.executeWebhook<unknown>(args.webhookId, args.webhookToken, { body, query }),
  );
  if (!result.ok) return errorResult(result.error);

  if (args.wait) return textResult(JSON.stringify(result.value, null, 2));
  return textResult(`Executed webhook ${args.webhookId}.`);
};

export const registerWebhookTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'list_webhooks',
    {
      title: 'List webhooks',
      description: 'List the webhooks in a channel. Returns each webhook, including its token.',
      inputSchema: listWebhooksInput,
      annotations: READ_ONLY,
    },
    async (args) => listWebhooks(args, ctx),
  );
  server.registerTool(
    'get_webhook',
    {
      title: 'Get webhook',
      description:
        'Get a single webhook by ID. Note: the token is only included when listing a channel\'s ' +
        'webhooks, not when fetching a webhook by ID.',
      inputSchema: getWebhookInput,
      annotations: READ_ONLY,
    },
    async (args) => getWebhook(args, ctx),
  );
  server.registerTool(
    'create_webhook',
    {
      title: 'Create webhook',
      description: 'Create a webhook in a channel.',
      inputSchema: createWebhookInput,
    },
    async (args) => createWebhook(args, ctx),
  );
  server.registerTool(
    'modify_webhook',
    {
      title: 'Modify webhook',
      description: 'Modify a webhook: name, avatar, or channel.',
      inputSchema: modifyWebhookInput,
      annotations: IDEMPOTENT,
    },
    async (args) => modifyWebhook(args, ctx),
  );
  server.registerTool(
    'delete_webhook',
    {
      title: 'Delete webhook',
      description: 'Delete a webhook. Requires explicit consent ("confirm": true).',
      inputSchema: deleteWebhookInput,
      annotations: DESTRUCTIVE,
    },
    async (args) => deleteWebhook(args, ctx),
  );
  server.registerTool(
    'execute_webhook',
    {
      title: 'Execute webhook',
      description:
        'Send a message through a webhook using its token. Supports content, embeds, components, ' +
        'a custom username/avatar, TTS, and thread targeting. The webhook token is never logged.',
      inputSchema: executeWebhookInput,
    },
    async (args) => executeWebhook(args, ctx),
  );
};

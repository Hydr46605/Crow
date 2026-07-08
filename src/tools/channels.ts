import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { attempt } from './attempt.js';
import { requireConsent } from './consent.js';
import { errorResult, textResult } from './result.js';
import { channelType, consent, snowflake } from './schemas.js';

const CHANNEL_TYPE_CODES = {
  text: 0,
  voice: 2,
  category: 4,
  announcement: 5,
  forum: 15,
} as const;

export type ChannelType = keyof typeof CHANNEL_TYPE_CODES;

const listChannelsInput = { guildId: snowflake };

const getChannelInput = { channelId: snowflake };

const modifyChannelInput = {
  channelId: snowflake,
  name: z.string().min(1).max(100).optional(),
  topic: z.string().max(1024).optional(),
  nsfw: z.boolean().optional(),
  rateLimitPerUser: z.number().int().min(0).max(21600).optional(),
  position: z.number().int().optional(),
};

const createChannelInput = {
  guildId: snowflake,
  name: z.string().min(1).max(100),
  type: channelType.optional(),
  topic: z.string().max(1024).optional(),
  nsfw: z.boolean().optional(),
  parentId: snowflake.optional(),
  position: z.number().int().optional(),
};

const deleteChannelInput = {
  channelId: snowflake,
  confirm: consent,
};

export interface ListChannelsArgs {
  readonly guildId: string;
}

export interface GetChannelArgs {
  readonly channelId: string;
}

export interface ModifyChannelArgs {
  readonly channelId: string;
  readonly name?: string;
  readonly topic?: string;
  readonly nsfw?: boolean;
  readonly rateLimitPerUser?: number;
  readonly position?: number;
}

export interface CreateChannelArgs {
  readonly guildId: string;
  readonly name: string;
  readonly type?: ChannelType;
  readonly topic?: string;
  readonly nsfw?: boolean;
  readonly parentId?: string;
  readonly position?: number;
}

export interface DeleteChannelArgs {
  readonly channelId: string;
  readonly confirm?: true;
}

interface RawChannel {
  readonly id: string;
  readonly name: string;
  readonly type: number;
  readonly topic?: string | null;
  readonly nsfw?: boolean;
  readonly position?: number;
  readonly parent_id?: string | null;
  readonly rate_limit_per_user?: number;
}

export interface ChannelSummary {
  readonly id: string;
  readonly name: string;
  readonly type: number;
  readonly topic?: string | null;
  readonly nsfw?: boolean;
  readonly position?: number;
  readonly parentId?: string | null;
  readonly rateLimitPerUser?: number;
}

export const summarizeChannel = (channel: RawChannel): ChannelSummary => ({
  id: channel.id,
  name: channel.name,
  type: channel.type,
  topic: channel.topic,
  nsfw: channel.nsfw,
  position: channel.position,
  parentId: channel.parent_id,
  rateLimitPerUser: channel.rate_limit_per_user,
});

export const listChannels = async (
  args: ListChannelsArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt(() =>
    ctx.discord.request<RawChannel[]>('GET', `/guilds/${args.guildId}/channels`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.map(summarizeChannel), null, 2));
};

export const getChannel = async (
  args: GetChannelArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt(() =>
    ctx.discord.request<RawChannel>('GET', `/channels/${args.channelId}`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeChannel(result.value), null, 2));
};

export const modifyChannel = async (
  args: ModifyChannelArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = {};
  if (args.name !== undefined) body.name = args.name;
  if (args.topic !== undefined) body.topic = args.topic;
  if (args.nsfw !== undefined) body.nsfw = args.nsfw;
  if (args.rateLimitPerUser !== undefined) body.rate_limit_per_user = args.rateLimitPerUser;
  if (args.position !== undefined) body.position = args.position;

  const result = await attempt(() =>
    ctx.discord.request<RawChannel>('PATCH', `/channels/${args.channelId}`, { body }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeChannel(result.value), null, 2));
};

export const createChannel = async (
  args: CreateChannelArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = {
    name: args.name,
    type: CHANNEL_TYPE_CODES[args.type ?? 'text'],
  };
  if (args.topic !== undefined) body.topic = args.topic;
  if (args.nsfw !== undefined) body.nsfw = args.nsfw;
  if (args.parentId !== undefined) body.parent_id = args.parentId;
  if (args.position !== undefined) body.position = args.position;

  const result = await attempt(() =>
    ctx.discord.request<RawChannel>('POST', `/guilds/${args.guildId}/channels`, { body }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeChannel(result.value), null, 2));
};

export const deleteChannel = async (
  args: DeleteChannelArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const gate = requireConsent(args.confirm);
  if (gate) return gate;

  const result = await attempt(() =>
    ctx.discord.request<unknown>('DELETE', `/channels/${args.channelId}`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Deleted channel ${args.channelId}.`);
};

export const registerChannelTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'list_channels',
    { description: 'List the channels in a guild.', inputSchema: listChannelsInput },
    async (args) => listChannels(args, ctx),
  );
  server.registerTool(
    'get_channel',
    { description: 'Get a single channel by ID.', inputSchema: getChannelInput },
    async (args) => getChannel(args, ctx),
  );
  server.registerTool(
    'modify_channel',
    {
      description: 'Modify a channel: name, topic (description), NSFW flag, slowmode, and position.',
      inputSchema: modifyChannelInput,
    },
    async (args) => modifyChannel(args, ctx),
  );
  server.registerTool(
    'create_channel',
    {
      description: 'Create a channel in a guild.',
      inputSchema: createChannelInput,
    },
    async (args) => createChannel(args, ctx),
  );
  server.registerTool(
    'delete_channel',
    {
      description: 'Delete a channel. Requires explicit consent ("confirm": true).',
      inputSchema: deleteChannelInput,
    },
    async (args) => deleteChannel(args, ctx),
  );
};

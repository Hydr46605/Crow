import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { IDEMPOTENT, READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { errorResult, textResult } from './result.js';
import { snowflake } from './schemas.js';

const getGuildInput = {
  guildId: snowflake.describe('The ID of the guild to fetch.'),
};

const modifyGuildInput = {
  guildId: snowflake.describe('The ID of the guild to modify.'),
  name: z.string().min(2).max(100).optional().describe('New guild name (2-100 characters).'),
  description: z
    .string()
    .max(300)
    .optional()
    .describe('New guild description (up to 300 characters).'),
  rulesChannelId: snowflake
    .optional()
    .describe('The channel to use as the community rules channel.'),
};

export interface GetGuildArgs {
  readonly guildId: string;
}

export interface ModifyGuildArgs {
  readonly guildId: string;
  readonly name?: string;
  readonly description?: string;
  readonly rulesChannelId?: string;
}

interface RawGuild {
  readonly id: string;
  readonly name: string;
  readonly owner_id?: string;
  readonly owner?: boolean;
  readonly member_count?: number;
  readonly approximate_member_count?: number;
  readonly approximate_presence_count?: number;
  readonly description?: string | null;
}

export interface GuildSummary {
  readonly id: string;
  readonly name: string;
  readonly ownerId?: string;
  readonly isOwner?: boolean;
  readonly memberCount?: number;
  readonly presenceCount?: number;
  readonly description?: string | null;
}

export const summarizeGuild = (guild: RawGuild): GuildSummary => ({
  id: guild.id,
  name: guild.name,
  ownerId: guild.owner_id,
  isOwner: guild.owner,
  memberCount: guild.member_count ?? guild.approximate_member_count,
  presenceCount: guild.approximate_presence_count,
  description: guild.description,
});

export const listGuilds = async (ctx: CrowContext): Promise<CallToolResult> => {
  const result = await attempt('list_guilds', () =>
    ctx.discord.request<RawGuild[]>('GET', '/users/@me/guilds', {
      query: { with_counts: true },
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.map(summarizeGuild), null, 2));
};

export const getGuild = async (args: GetGuildArgs, ctx: CrowContext): Promise<CallToolResult> => {
  const result = await attempt('get_guild', () =>
    ctx.discord.request<RawGuild>('GET', `/guilds/${args.guildId}`, {
      query: { with_counts: true },
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeGuild(result.value), null, 2));
};

export const modifyGuild = async (
  args: ModifyGuildArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = {};
  if (args.name !== undefined) body.name = args.name;
  if (args.description !== undefined) body.description = args.description;
  if (args.rulesChannelId !== undefined) body.rules_channel_id = args.rulesChannelId;

  const result = await attempt('modify_guild', () =>
    ctx.discord.request<RawGuild>('PATCH', `/guilds/${args.guildId}`, { body }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeGuild(result.value), null, 2));
};

export const registerGuildTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'list_guilds',
    {
      title: 'List guilds',
      description:
        'List the guilds (servers) the bot is a member of, with approximate member counts. ' +
        'Use this first to discover the guilds available for selection.',
      annotations: READ_ONLY,
    },
    async () => listGuilds(ctx),
  );
  server.registerTool(
    'get_guild',
    {
      title: 'Get guild',
      description: 'Get details (name, owner, description, member counts) for a single guild by ID.',
      inputSchema: getGuildInput,
      annotations: READ_ONLY,
    },
    async (args) => getGuild(args, ctx),
  );
  server.registerTool(
    'modify_guild',
    {
      title: 'Modify guild',
      description:
        'Modify guild settings: name, description, and the community rules channel. ' +
        'Setting a rules channel requires the COMMUNITY feature to be enabled.',
      inputSchema: modifyGuildInput,
      annotations: IDEMPOTENT,
    },
    async (args) => modifyGuild(args, ctx),
  );
};

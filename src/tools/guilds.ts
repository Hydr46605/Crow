import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { toErrorMessage } from '../discord/client.js';
import { errorResult, textResult } from './result.js';
import { snowflake } from './schemas.js';

const getGuildInput = { guildId: snowflake };

export interface GetGuildArgs {
  readonly guildId: string;
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
  try {
    const guilds = await ctx.discord.request<RawGuild[]>('GET', '/users/@me/guilds', {
      query: { with_counts: true },
    });
    return textResult(JSON.stringify(guilds.map(summarizeGuild), null, 2));
  } catch (error) {
    return errorResult(toErrorMessage(error));
  }
};

export const getGuild = async (args: GetGuildArgs, ctx: CrowContext): Promise<CallToolResult> => {
  try {
    const guild = await ctx.discord.request<RawGuild>('GET', `/guilds/${args.guildId}`, {
      query: { with_counts: true },
    });
    return textResult(JSON.stringify(summarizeGuild(guild), null, 2));
  } catch (error) {
    return errorResult(toErrorMessage(error));
  }
};

export const registerGuildTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'list_guilds',
    {
      description:
        'List the guilds (servers) the bot is a member of. Use this first to discover available guilds.',
    },
    async () => listGuilds(ctx),
  );
  server.registerTool(
    'get_guild',
    {
      description: 'Get details for a single guild by ID.',
      inputSchema: getGuildInput,
    },
    async (args) => getGuild(args, ctx),
  );
};

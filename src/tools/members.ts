import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { toErrorMessage } from '../discord/client.js';
import { errorResult, textResult } from './result.js';
import { snowflake } from './schemas.js';

const listMembersInput = {
  guildId: snowflake,
  query: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  after: snowflake.optional(),
};

const getMemberInput = {
  guildId: snowflake,
  userId: snowflake,
};

export interface ListMembersArgs {
  readonly guildId: string;
  readonly query?: string;
  readonly limit?: number;
  readonly after?: string;
}

export interface GetMemberArgs {
  readonly guildId: string;
  readonly userId: string;
}

interface RawMember {
  readonly user: {
    readonly id: string;
    readonly username: string;
    readonly discriminator: string;
    readonly bot?: boolean;
  };
  readonly nick?: string | null;
  readonly roles: readonly string[];
  readonly joined_at: string;
  readonly pending?: boolean;
}

export interface MemberSummary {
  readonly userId: string;
  readonly username: string;
  readonly discriminator: string;
  readonly bot: boolean;
  readonly nickname?: string | null;
  readonly roles: readonly string[];
  readonly joinedAt: string;
  readonly pending?: boolean;
}

export const summarizeMember = (member: RawMember): MemberSummary => ({
  userId: member.user.id,
  username: member.user.username,
  discriminator: member.user.discriminator,
  bot: member.user.bot ?? false,
  nickname: member.nick,
  roles: member.roles,
  joinedAt: member.joined_at,
  pending: member.pending,
});

export const listMembers = async (args: ListMembersArgs, ctx: CrowContext): Promise<CallToolResult> => {
  try {
    const members = await ctx.discord.request<RawMember[]>('GET', `/guilds/${args.guildId}/members`, {
      query: { limit: args.limit, after: args.after, query: args.query },
    });
    return textResult(JSON.stringify(members.map(summarizeMember), null, 2));
  } catch (error) {
    return errorResult(toErrorMessage(error));
  }
};

export const getMember = async (args: GetMemberArgs, ctx: CrowContext): Promise<CallToolResult> => {
  try {
    const member = await ctx.discord.request<RawMember>(
      'GET',
      `/guilds/${args.guildId}/members/${args.userId}`,
    );
    return textResult(JSON.stringify(summarizeMember(member), null, 2));
  } catch (error) {
    return errorResult(toErrorMessage(error));
  }
};

export const registerMemberTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'list_members',
    {
      description:
        'List members of a guild, optionally filtered by a username search. ' +
        'May require the GUILD_MEMBERS privileged intent for the bot.',
      inputSchema: listMembersInput,
    },
    async (args) => listMembers(args, ctx),
  );
  server.registerTool(
    'get_member',
    {
      description: 'Get a single guild member by user ID.',
      inputSchema: getMemberInput,
    },
    async (args) => getMember(args, ctx),
  );
};

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { IDEMPOTENT, READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { errorResult, textResult } from './result.js';
import { snowflake } from './schemas.js';

const listMembersInput = {
  guildId: snowflake.describe('The ID of the guild whose members to list.'),
  query: z
    .string()
    .max(100)
    .optional()
    .describe('Filter members whose username or nickname starts with this text.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe('Maximum number of members to return (1-1000).'),
  after: snowflake.optional().describe('Return members after this user ID (for pagination).'),
};

const getMemberInput = {
  guildId: snowflake.describe('The ID of the guild the member belongs to.'),
  userId: snowflake.describe('The ID of the user to fetch.'),
};

export const modifyMemberInput = z
  .object({
    guildId: snowflake.describe('The ID of the guild the member belongs to.'),
    userId: snowflake.describe('The ID of the member to modify.'),
    nick: z.string().min(1).max(32).nullable().optional().describe('New nickname, or null to reset it.'),
    mute: z.boolean().optional().describe('Whether the member is server-muted in voice channels.'),
    deaf: z.boolean().optional().describe('Whether the member is server-deafened in voice channels.'),
    channelId: snowflake
      .nullable()
      .optional()
      .describe('Voice channel to move the member to, or null to disconnect them.'),
    timeoutUntil: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional()
      .describe('ISO-8601 timestamp until which the member is timed out, or null to lift the timeout.'),
    reason: z.string().max(512).optional().describe('Audit-log reason.'),
  })
  .superRefine((args, ctx) => {
    if (
      args.nick === undefined &&
      args.mute === undefined &&
      args.deaf === undefined &&
      args.channelId === undefined &&
      args.timeoutUntil === undefined
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Provide at least one field to modify.' });
    }
  });

const addRoleToMemberInput = {
  guildId: snowflake.describe('The ID of the guild the member belongs to.'),
  userId: snowflake.describe('The ID of the member to add the role to.'),
  roleId: snowflake.describe('The ID of the role to assign.'),
};

const removeRoleFromMemberInput = {
  guildId: snowflake.describe('The ID of the guild the member belongs to.'),
  userId: snowflake.describe('The ID of the member to remove the role from.'),
  roleId: snowflake.describe('The ID of the role to remove.'),
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

export const listMembers = async (
  args: ListMembersArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('list_members', () =>
    ctx.discord.request<RawMember[]>('GET', `/guilds/${args.guildId}/members`, {
      query: { limit: args.limit, after: args.after, query: args.query },
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.map(summarizeMember), null, 2));
};

export const getMember = async (args: GetMemberArgs, ctx: CrowContext): Promise<CallToolResult> => {
  const result = await attempt('get_member', () =>
    ctx.discord.request<RawMember>('GET', `/guilds/${args.guildId}/members/${args.userId}`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeMember(result.value), null, 2));
};

export interface ModifyMemberArgs {
  readonly guildId: string;
  readonly userId: string;
  readonly nick?: string | null;
  readonly mute?: boolean;
  readonly deaf?: boolean;
  readonly channelId?: string | null;
  readonly timeoutUntil?: string | null;
  readonly reason?: string;
}

export interface MemberRoleArgs {
  readonly guildId: string;
  readonly userId: string;
  readonly roleId: string;
}

export const modifyMember = async (
  args: ModifyMemberArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = {};
  if (args.nick !== undefined) body.nick = args.nick;
  if (args.mute !== undefined) body.mute = args.mute;
  if (args.deaf !== undefined) body.deaf = args.deaf;
  if (args.channelId !== undefined) body.channel_id = args.channelId;
  if (args.timeoutUntil !== undefined) body.communication_disabled_until = args.timeoutUntil;

  const result = await attempt('modify_member', () =>
    ctx.discord.request<unknown>('PATCH', `/guilds/${args.guildId}/members/${args.userId}`, {
      body,
      reason: args.reason,
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Modified member ${args.userId} in guild ${args.guildId}.`);
};

export const addRoleToMember = async (
  args: MemberRoleArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('add_role_to_member', () =>
    ctx.discord.request<unknown>(
      'PUT',
      `/guilds/${args.guildId}/members/${args.userId}/roles/${args.roleId}`,
    ),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Added role ${args.roleId} to member ${args.userId}.`);
};

export const removeRoleFromMember = async (
  args: MemberRoleArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('remove_role_from_member', () =>
    ctx.discord.request<unknown>(
      'DELETE',
      `/guilds/${args.guildId}/members/${args.userId}/roles/${args.roleId}`,
    ),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Removed role ${args.roleId} from member ${args.userId}.`);
};

export const registerMemberTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'list_members',
    {
      title: 'List members',
      description:
        'List members of a guild, optionally filtered by a username search. ' +
        'May require the GUILD_MEMBERS privileged intent for the bot.',
      inputSchema: listMembersInput,
      annotations: READ_ONLY,
    },
    async (args) => listMembers(args, ctx),
  );
  server.registerTool(
    'get_member',
    {
      title: 'Get member',
      description: 'Get a single guild member (user, nickname, roles, join date) by user ID.',
      inputSchema: getMemberInput,
      annotations: READ_ONLY,
    },
    async (args) => getMember(args, ctx),
  );
  server.registerTool(
    'modify_member',
    {
      title: 'Modify member',
      description:
        'Modify a member: nickname, voice mute/deafen, voice channel, or a timeout. ' +
        'Roles are managed via add_role_to_member and remove_role_from_member.',
      inputSchema: modifyMemberInput,
      annotations: IDEMPOTENT,
    },
    async (args) => modifyMember(args, ctx),
  );
  server.registerTool(
    'add_role_to_member',
    {
      title: 'Add role to member',
      description: 'Assign a role to a guild member.',
      inputSchema: addRoleToMemberInput,
      annotations: IDEMPOTENT,
    },
    async (args) => addRoleToMember(args, ctx),
  );
  server.registerTool(
    'remove_role_from_member',
    {
      title: 'Remove role from member',
      description: 'Remove a role from a guild member.',
      inputSchema: removeRoleFromMemberInput,
      annotations: IDEMPOTENT,
    },
    async (args) => removeRoleFromMember(args, ctx),
  );
};

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

const timeoutMemberInput = {
  guildId: snowflake.describe('The ID of the guild the member belongs to.'),
  userId: snowflake.describe('The ID of the member to time out.'),
  durationMinutes: z
    .number()
    .int()
    .min(1)
    .max(40320)
    .describe('How long to time out the member, in minutes (1-40320 = up to 4 weeks).'),
  reason: z.string().max(512).optional().describe('Audit-log reason.'),
};

const removeTimeoutMemberInput = {
  guildId: snowflake.describe('The ID of the guild the member belongs to.'),
  userId: snowflake.describe('The ID of the member whose timeout to lift.'),
  reason: z.string().max(512).optional().describe('Audit-log reason.'),
};

const setMemberNicknameInput = {
  guildId: snowflake.describe('The ID of the guild the member belongs to.'),
  userId: snowflake.describe('The ID of the member to nickname.'),
  nick: z.string().min(1).max(32).describe('The new nickname (1-32 characters).'),
  reason: z.string().max(512).optional().describe('Audit-log reason.'),
};

const resetMemberNicknameInput = {
  guildId: snowflake.describe('The ID of the guild the member belongs to.'),
  userId: snowflake.describe('The ID of the member whose nickname to reset.'),
  reason: z.string().max(512).optional().describe('Audit-log reason.'),
};

const disconnectMemberFromVoiceInput = {
  guildId: snowflake.describe('The ID of the guild the member belongs to.'),
  userId: snowflake.describe('The ID of the member to disconnect from voice.'),
  reason: z.string().max(512).optional().describe('Audit-log reason.'),
};

const moveMemberToVoiceInput = {
  guildId: snowflake.describe('The ID of the guild the member belongs to.'),
  userId: snowflake.describe('The ID of the member to move.'),
  channelId: snowflake.describe('The voice channel to move the member to.'),
  reason: z.string().max(512).optional().describe('Audit-log reason.'),
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

export interface TimeoutMemberArgs {
  readonly guildId: string;
  readonly userId: string;
  readonly durationMinutes: number;
  readonly reason?: string;
}

export interface RemoveTimeoutMemberArgs {
  readonly guildId: string;
  readonly userId: string;
  readonly reason?: string;
}

export interface SetMemberNicknameArgs {
  readonly guildId: string;
  readonly userId: string;
  readonly nick: string;
  readonly reason?: string;
}

export interface ResetMemberNicknameArgs {
  readonly guildId: string;
  readonly userId: string;
  readonly reason?: string;
}

export interface DisconnectMemberFromVoiceArgs {
  readonly guildId: string;
  readonly userId: string;
  readonly reason?: string;
}

export interface MoveMemberToVoiceArgs {
  readonly guildId: string;
  readonly userId: string;
  readonly channelId: string;
  readonly reason?: string;
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

/** Shared PATCH helper for the dedicated member-moderation tools. */
const patchMember = async (
  label: string,
  args: { readonly guildId: string; readonly userId: string; readonly reason?: string },
  body: Record<string, unknown>,
  success: string,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt(label, () =>
    ctx.discord.request<unknown>('PATCH', `/guilds/${args.guildId}/members/${args.userId}`, {
      body,
      reason: args.reason,
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(success);
};

export const timeoutMember = async (
  args: TimeoutMemberArgs,
  ctx: CrowContext,
): Promise<CallToolResult> =>
  patchMember(
    'timeout_member',
    args,
    { communication_disabled_until: new Date(Date.now() + args.durationMinutes * 60_000).toISOString() },
    `Timed out member ${args.userId} in guild ${args.guildId} for ${args.durationMinutes} minutes.`,
    ctx,
  );

export const removeTimeoutMember = async (
  args: RemoveTimeoutMemberArgs,
  ctx: CrowContext,
): Promise<CallToolResult> =>
  patchMember(
    'remove_timeout_member',
    args,
    { communication_disabled_until: null },
    `Lifted the timeout on member ${args.userId} in guild ${args.guildId}.`,
    ctx,
  );

export const setMemberNickname = async (
  args: SetMemberNicknameArgs,
  ctx: CrowContext,
): Promise<CallToolResult> =>
  patchMember(
    'set_member_nickname',
    args,
    { nick: args.nick },
    `Set member ${args.userId}'s nickname in guild ${args.guildId}.`,
    ctx,
  );

export const resetMemberNickname = async (
  args: ResetMemberNicknameArgs,
  ctx: CrowContext,
): Promise<CallToolResult> =>
  patchMember(
    'reset_member_nickname',
    args,
    { nick: null },
    `Reset member ${args.userId}'s nickname in guild ${args.guildId}.`,
    ctx,
  );

export const disconnectMemberFromVoice = async (
  args: DisconnectMemberFromVoiceArgs,
  ctx: CrowContext,
): Promise<CallToolResult> =>
  patchMember(
    'disconnect_member_from_voice',
    args,
    { channel_id: null },
    `Disconnected member ${args.userId} from voice in guild ${args.guildId}.`,
    ctx,
  );

export const moveMemberToVoice = async (
  args: MoveMemberToVoiceArgs,
  ctx: CrowContext,
): Promise<CallToolResult> =>
  patchMember(
    'move_member_to_voice',
    args,
    { channel_id: args.channelId },
    `Moved member ${args.userId} to voice channel ${args.channelId}.`,
    ctx,
  );

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
        'Generic member edit: nickname, voice mute/deafen, voice channel, or a timeout. ' +
        'Prefer the dedicated tools (set_member_nickname, reset_member_nickname, move_member_to_voice, ' +
        'disconnect_member_from_voice, timeout_member, remove_timeout_member); roles use ' +
        'add_role_to_member and remove_role_from_member.',
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
  server.registerTool(
    'timeout_member',
    {
      title: 'Timeout member',
      description: 'Time out a member so they cannot send messages or speak for a number of minutes.',
      inputSchema: timeoutMemberInput,
      annotations: IDEMPOTENT,
    },
    async (args) => timeoutMember(args, ctx),
  );
  server.registerTool(
    'remove_timeout_member',
    {
      title: 'Remove member timeout',
      description: 'Lift a member\'s timeout early, restoring their ability to communicate.',
      inputSchema: removeTimeoutMemberInput,
      annotations: IDEMPOTENT,
    },
    async (args) => removeTimeoutMember(args, ctx),
  );
  server.registerTool(
    'set_member_nickname',
    {
      title: 'Set member nickname',
      description: 'Set a guild member\'s nickname.',
      inputSchema: setMemberNicknameInput,
      annotations: IDEMPOTENT,
    },
    async (args) => setMemberNickname(args, ctx),
  );
  server.registerTool(
    'reset_member_nickname',
    {
      title: 'Reset member nickname',
      description: 'Reset a guild member\'s nickname to their account username.',
      inputSchema: resetMemberNicknameInput,
      annotations: IDEMPOTENT,
    },
    async (args) => resetMemberNickname(args, ctx),
  );
  server.registerTool(
    'disconnect_member_from_voice',
    {
      title: 'Disconnect member from voice',
      description: 'Disconnect a member from their voice channel.',
      inputSchema: disconnectMemberFromVoiceInput,
      annotations: IDEMPOTENT,
    },
    async (args) => disconnectMemberFromVoice(args, ctx),
  );
  server.registerTool(
    'move_member_to_voice',
    {
      title: 'Move member to voice',
      description: 'Move a member to a different voice channel.',
      inputSchema: moveMemberToVoiceInput,
      annotations: IDEMPOTENT,
    },
    async (args) => moveMemberToVoice(args, ctx),
  );
};

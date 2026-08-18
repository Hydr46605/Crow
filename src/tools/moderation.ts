import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { DESTRUCTIVE, DESTRUCTIVE_IDEMPOTENT, IDEMPOTENT, READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { requireConsent } from './consent.js';
import { errorResult, textResult } from './result.js';
import { consent, snowflake } from './schemas.js';

const listBansInput = {
  guildId: snowflake.describe('The ID of the guild whose bans to list.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe('Maximum number of bans to return (1-1000).'),
};

const getBanInput = {
  guildId: snowflake.describe('The ID of the guild.'),
  userId: snowflake.describe('The ID of the banned user.'),
};

const kickMemberInput = {
  guildId: snowflake.describe('The ID of the guild to kick the member from.'),
  userId: snowflake.describe('The ID of the member to kick.'),
  confirm: consent,
  reason: z.string().max(512).optional().describe('Audit-log reason for the kick.'),
};

const banMemberInput = {
  guildId: snowflake.describe('The ID of the guild to ban the member from.'),
  userId: snowflake.describe('The ID of the member to ban.'),
  confirm: consent,
  deleteMessageDays: z
    .number()
    .int()
    .min(0)
    .max(7)
    .optional()
    .describe('Delete messages sent by the user in the last 0-7 days.'),
  reason: z.string().max(512).optional().describe('Audit-log reason for the ban.'),
};

const unbanMemberInput = {
  guildId: snowflake.describe('The ID of the guild.'),
  userId: snowflake.describe('The ID of the user to unban.'),
  reason: z.string().max(512).optional().describe('Audit-log reason for the unban.'),
};

const getPruneCountInput = {
  guildId: snowflake.describe('The ID of the guild to count prunable members for.'),
  days: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .describe('Number of days of inactivity (1-30, default 7).'),
  includeRoles: z
    .array(snowflake)
    .optional()
    .describe('Roles to include as prunable even if the member has other roles.'),
};

export interface ListBansArgs {
  readonly guildId: string;
  readonly limit?: number;
}

export interface GetBanArgs {
  readonly guildId: string;
  readonly userId: string;
}

export interface KickMemberArgs {
  readonly guildId: string;
  readonly userId: string;
  readonly confirm?: true;
  readonly reason?: string;
}

export interface BanMemberArgs {
  readonly guildId: string;
  readonly userId: string;
  readonly confirm?: true;
  readonly deleteMessageDays?: number;
  readonly reason?: string;
}

export interface UnbanMemberArgs {
  readonly guildId: string;
  readonly userId: string;
  readonly reason?: string;
}

export interface GetPruneCountArgs {
  readonly guildId: string;
  readonly days?: number;
  readonly includeRoles?: readonly string[];
}

interface RawBan {
  readonly reason: string | null;
  readonly user: { readonly id: string; readonly username: string; readonly discriminator: string };
}

export interface BanSummary {
  readonly userId: string;
  readonly username: string;
  readonly discriminator: string;
  readonly reason: string | null;
}

export const summarizeBan = (ban: RawBan): BanSummary => ({
  userId: ban.user.id,
  username: ban.user.username,
  discriminator: ban.user.discriminator,
  reason: ban.reason,
});

export const deleteMessageSeconds = (days: number | undefined): number => (days ?? 0) * 86_400;

export const listBans = async (args: ListBansArgs, ctx: CrowContext): Promise<CallToolResult> => {
  const result = await attempt('list_bans', () =>
    ctx.discord.request<RawBan[]>('GET', `/guilds/${args.guildId}/bans`, {
      query: { limit: args.limit },
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.map(summarizeBan), null, 2));
};

export const getBan = async (args: GetBanArgs, ctx: CrowContext): Promise<CallToolResult> => {
  const result = await attempt('get_ban', () =>
    ctx.discord.request<RawBan>('GET', `/guilds/${args.guildId}/bans/${args.userId}`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeBan(result.value), null, 2));
};

export const kickMember = async (args: KickMemberArgs, ctx: CrowContext): Promise<CallToolResult> => {
  const gate = requireConsent(args.confirm);
  if (gate) return gate;

  const result = await attempt('kick_member', () =>
    ctx.discord.request<unknown>('DELETE', `/guilds/${args.guildId}/members/${args.userId}`, {
      reason: args.reason,
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Kicked user ${args.userId} from guild ${args.guildId}.`);
};

export const banMember = async (args: BanMemberArgs, ctx: CrowContext): Promise<CallToolResult> => {
  const gate = requireConsent(args.confirm);
  if (gate) return gate;

  const result = await attempt('ban_member', () =>
    ctx.discord.request<unknown>('PUT', `/guilds/${args.guildId}/bans/${args.userId}`, {
      body: { delete_message_seconds: deleteMessageSeconds(args.deleteMessageDays) },
      reason: args.reason,
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Banned user ${args.userId} from guild ${args.guildId}.`);
};

export const unbanMember = async (
  args: UnbanMemberArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('unban_member', () =>
    ctx.discord.request<unknown>('DELETE', `/guilds/${args.guildId}/bans/${args.userId}`, {
      reason: args.reason,
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Unbanned user ${args.userId} from guild ${args.guildId}.`);
};

/** Counts members that would be pruned, without actually pruning them (read-only). */
export const getPruneCount = async (
  args: GetPruneCountArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('get_prune_count', () =>
    ctx.discord.request<{ readonly pruned: number }>('GET', `/guilds/${args.guildId}/prune`, {
      query: { days: args.days, include_roles: args.includeRoles?.join(',') },
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify({ pruned: result.value.pruned }, null, 2));
};

export const registerModerationTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'list_bans',
    {
      title: 'List bans',
      description: 'List the bans in a guild.',
      inputSchema: listBansInput,
      annotations: READ_ONLY,
    },
    async (args) => listBans(args, ctx),
  );
  server.registerTool(
    'get_ban',
    {
      title: 'Get ban',
      description: 'Get a single ban by user ID.',
      inputSchema: getBanInput,
      annotations: READ_ONLY,
    },
    async (args) => getBan(args, ctx),
  );
  server.registerTool(
    'kick_member',
    {
      title: 'Kick member',
      description: 'Kick a member from a guild. Requires explicit consent ("confirm": true).',
      inputSchema: kickMemberInput,
      annotations: DESTRUCTIVE,
    },
    async (args) => kickMember(args, ctx),
  );
  server.registerTool(
    'ban_member',
    {
      title: 'Ban member',
      description:
        'Ban a member from a guild, optionally deleting their recent messages. ' +
        'Requires explicit consent ("confirm": true).',
      inputSchema: banMemberInput,
      annotations: DESTRUCTIVE_IDEMPOTENT,
    },
    async (args) => banMember(args, ctx),
  );
  server.registerTool(
    'unban_member',
    {
      title: 'Unban member',
      description: 'Remove a ban from a guild.',
      inputSchema: unbanMemberInput,
      annotations: IDEMPOTENT,
    },
    async (args) => unbanMember(args, ctx),
  );
  server.registerTool(
    'get_prune_count',
    {
      title: 'Get prune count',
      description:
        'Count the members that would be pruned after a number of inactive days. ' +
        'Read-only: it does not actually prune anyone.',
      inputSchema: getPruneCountInput,
      annotations: READ_ONLY,
    },
    async (args) => getPruneCount(args, ctx),
  );
};

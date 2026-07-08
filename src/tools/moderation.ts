import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { attempt } from './attempt.js';
import { requireConsent } from './consent.js';
import { errorResult, textResult } from './result.js';
import { consent, snowflake } from './schemas.js';

const listBansInput = {
  guildId: snowflake,
  limit: z.number().int().min(1).max(1000).optional(),
};

const getBanInput = {
  guildId: snowflake,
  userId: snowflake,
};

const kickMemberInput = {
  guildId: snowflake,
  userId: snowflake,
  confirm: consent,
  reason: z.string().max(512).optional(),
};

const banMemberInput = {
  guildId: snowflake,
  userId: snowflake,
  confirm: consent,
  deleteMessageDays: z.number().int().min(0).max(7).optional(),
  reason: z.string().max(512).optional(),
};

const unbanMemberInput = {
  guildId: snowflake,
  userId: snowflake,
  reason: z.string().max(512).optional(),
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
  const result = await attempt(() =>
    ctx.discord.request<RawBan[]>('GET', `/guilds/${args.guildId}/bans`, {
      query: { limit: args.limit },
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.map(summarizeBan), null, 2));
};

export const getBan = async (args: GetBanArgs, ctx: CrowContext): Promise<CallToolResult> => {
  const result = await attempt(() =>
    ctx.discord.request<RawBan>('GET', `/guilds/${args.guildId}/bans/${args.userId}`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeBan(result.value), null, 2));
};

export const kickMember = async (args: KickMemberArgs, ctx: CrowContext): Promise<CallToolResult> => {
  const gate = requireConsent(args.confirm);
  if (gate) return gate;

  const result = await attempt(() =>
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

  const result = await attempt(() =>
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
  const result = await attempt(() =>
    ctx.discord.request<unknown>('DELETE', `/guilds/${args.guildId}/bans/${args.userId}`, {
      reason: args.reason,
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Unbanned user ${args.userId} from guild ${args.guildId}.`);
};

export const registerModerationTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'list_bans',
    { description: 'List bans for a guild.', inputSchema: listBansInput },
    async (args) => listBans(args, ctx),
  );
  server.registerTool(
    'get_ban',
    { description: 'Get a single ban by user ID.', inputSchema: getBanInput },
    async (args) => getBan(args, ctx),
  );
  server.registerTool(
    'kick_member',
    {
      description: 'Kick a member from a guild. Requires explicit consent ("confirm": true).',
      inputSchema: kickMemberInput,
    },
    async (args) => kickMember(args, ctx),
  );
  server.registerTool(
    'ban_member',
    {
      description: 'Ban a member from a guild. Requires explicit consent ("confirm": true).',
      inputSchema: banMemberInput,
    },
    async (args) => banMember(args, ctx),
  );
  server.registerTool(
    'unban_member',
    { description: 'Remove a ban from a guild.', inputSchema: unbanMemberInput },
    async (args) => unbanMember(args, ctx),
  );
};

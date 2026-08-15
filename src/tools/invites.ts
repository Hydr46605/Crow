import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { DESTRUCTIVE, READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { requireConsent } from './consent.js';
import { errorResult, textResult } from './result.js';
import { consent, snowflake } from './schemas.js';

const inviteCodeSchema = z
  .string()
  .min(1)
  .max(128)
  .describe('Invite code, or a full discord.gg / discord.com/invite URL.');

const targetTypeSchema = z
  .enum(['stream', 'embeddedApplication'])
  .describe('Invite target type: stream or embedded application.');

const createInviteInput = z
  .object({
    channelId: snowflake.describe('The ID of the channel the invite points to.'),
    maxAge: z
      .number()
      .int()
      .min(0)
      .max(604800)
      .optional()
      .describe('Invite lifetime in seconds (0 for never, max 604800).'),
    maxUses: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .describe('Maximum uses (0 for unlimited, max 100).'),
    temporary: z
      .boolean()
      .optional()
      .describe('Whether members are removed after leaving voice.'),
    unique: z.boolean().optional().describe('Whether to always mint a distinct invite code.'),
    targetType: targetTypeSchema.optional(),
    targetUserId: snowflake.optional().describe('Target user ID (required for stream invites).'),
    targetApplicationId: snowflake
      .optional()
      .describe('Target application ID (required for embedded application invites).'),
    reason: z.string().max(512).optional().describe('Audit-log reason for creating the invite.'),
  })
  .superRefine((args, ctx) => {
    if (args.targetType === 'stream' && !args.targetUserId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Stream invites require "targetUserId".' });
    }
    if (args.targetType === 'embeddedApplication' && !args.targetApplicationId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Embedded application invites require "targetApplicationId".',
      });
    }
  });

export type CreateInviteArgs = z.infer<typeof createInviteInput>;

const INVITE_CODE_RE = /^[a-zA-Z0-9]+$/;

/** Extracts a bare invite code from a code or a discord.gg / discord.com/invite URL. */
export const normalizeInviteCode = (input: string): string => {
  let value = input.trim();
  if (value.includes('/')) {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    const parts = url.pathname.split('/').filter((part) => part.length > 0);
    value = parts[parts.length - 1] ?? '';
  }
  if (!INVITE_CODE_RE.test(value)) {
    throw new Error(`Invalid invite code: ${input}`);
  }
  return value;
};

interface RawInvite {
  readonly code: string;
  readonly type?: number;
  readonly id?: string;
  readonly guild?: { readonly id: string; readonly name: string };
  readonly guild_id?: string;
  readonly channel?: { readonly id: string; readonly name: string; readonly type: number };
  readonly inviter?: { readonly id: string; readonly username: string };
  readonly uses?: number;
  readonly max_uses?: number;
  readonly max_age?: number;
  readonly temporary?: boolean;
  readonly created_at?: string;
  readonly expires_at?: string | null;
  readonly approximate_member_count?: number;
  readonly approximate_presence_count?: number;
  readonly profile?: { readonly member_count?: number; readonly online_count?: number };
}

export interface InviteSummary {
  readonly code: string;
  readonly inviteId?: string;
  readonly type?: number;
  readonly guildId?: string;
  readonly guildName?: string;
  readonly channelId?: string;
  readonly channelName?: string;
  readonly inviterId?: string;
  readonly uses?: number;
  readonly maxUses?: number;
  readonly maxAge?: number;
  readonly temporary?: boolean;
  readonly createdAt?: string;
  readonly expiresAt?: string | null;
  readonly memberCount?: number;
  readonly onlineCount?: number;
  readonly approximateMemberCount?: number;
  readonly approximatePresenceCount?: number;
}

export const summarizeInvite = (invite: RawInvite): InviteSummary => ({
  code: invite.code,
  inviteId: invite.id,
  type: invite.type,
  guildId: invite.guild_id ?? invite.guild?.id,
  guildName: invite.guild?.name,
  channelId: invite.channel?.id,
  channelName: invite.channel?.name,
  inviterId: invite.inviter?.id,
  uses: invite.uses,
  maxUses: invite.max_uses,
  maxAge: invite.max_age,
  temporary: invite.temporary,
  createdAt: invite.created_at,
  expiresAt: invite.expires_at,
  memberCount: invite.profile?.member_count,
  onlineCount: invite.profile?.online_count,
  approximateMemberCount: invite.approximate_member_count,
  approximatePresenceCount: invite.approximate_presence_count,
});

export const listGuildInvites = async (
  args: { readonly guildId: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('list_guild_invites', () =>
    ctx.discord.request<RawInvite[]>('GET', `/guilds/${args.guildId}/invites`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.map(summarizeInvite), null, 2));
};

export const listChannelInvites = async (
  args: { readonly channelId: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('list_channel_invites', () =>
    ctx.discord.request<RawInvite[]>('GET', `/channels/${args.channelId}/invites`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.map(summarizeInvite), null, 2));
};

export const getInvite = async (
  args: { readonly code: string; readonly withCounts?: boolean; readonly withExpiration?: boolean },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('get_invite', () =>
    ctx.discord.request<RawInvite>('GET', `/invites/${normalizeInviteCode(args.code)}`, {
      query: { with_counts: args.withCounts, with_expiration: args.withExpiration },
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeInvite(result.value), null, 2));
};

export const getVanityUrl = async (
  args: { readonly guildId: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('get_vanity_url', () =>
    ctx.discord.request<{ code: string; uses: number }>('GET', `/guilds/${args.guildId}/vanity-url`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value, null, 2));
};

export const createInvite = async (
  args: CreateInviteArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = {};
  if (args.maxAge !== undefined) body.max_age = args.maxAge;
  if (args.maxUses !== undefined) body.max_uses = args.maxUses;
  if (args.temporary !== undefined) body.temporary = args.temporary;
  if (args.unique !== undefined) body.unique = args.unique;
  if (args.targetType !== undefined) body.target_type = args.targetType === 'stream' ? 1 : 2;
  if (args.targetUserId !== undefined) body.target_user_id = args.targetUserId;
  if (args.targetApplicationId !== undefined) body.target_application_id = args.targetApplicationId;

  const result = await attempt('create_invite', () =>
    ctx.discord.request<RawInvite>('POST', `/channels/${args.channelId}/invites`, {
      body,
      reason: args.reason,
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeInvite(result.value), null, 2));
};

export const deleteInvite = async (
  args: { readonly code: string; readonly confirm?: true },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const gate = requireConsent(args.confirm);
  if (gate) return gate;

  const result = await attempt('delete_invite', () =>
    ctx.discord.request<unknown>('DELETE', `/invites/${normalizeInviteCode(args.code)}`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Deleted invite ${args.code}.`);
};

export const registerInviteTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'list_guild_invites',
    {
      title: 'List guild invites',
      description: 'List the invites for a guild.',
      inputSchema: { guildId: snowflake.describe('The ID of the guild whose invites to list.') },
      annotations: READ_ONLY,
    },
    async (args) => listGuildInvites(args, ctx),
  );
  server.registerTool(
    'list_channel_invites',
    {
      title: 'List channel invites',
      description: 'List the invites for a channel.',
      inputSchema: { channelId: snowflake.describe('The ID of the channel whose invites to list.') },
      annotations: READ_ONLY,
    },
    async (args) => listChannelInvites(args, ctx),
  );
  server.registerTool(
    'get_invite',
    {
      title: 'Get invite',
      description: 'Get invite metadata by code or URL, optionally with counts and expiration.',
      inputSchema: {
        code: inviteCodeSchema,
        withCounts: z.boolean().optional().describe('Include approximate member/presence counts.'),
        withExpiration: z.boolean().optional().describe('Include the expiration date.'),
      },
      annotations: READ_ONLY,
    },
    async (args) => getInvite(args, ctx),
  );
  server.registerTool(
    'get_vanity_url',
    {
      title: 'Get vanity URL',
      description: "Get a guild's vanity invite URL, if it has one.",
      inputSchema: { guildId: snowflake.describe('The ID of the guild.') },
      annotations: READ_ONLY,
    },
    async (args) => getVanityUrl(args, ctx),
  );
  server.registerTool(
    'create_invite',
    {
      title: 'Create invite',
      description:
        'Create an invite for a channel, with optional max age, max uses, target type, and reason.',
      inputSchema: createInviteInput,
    },
    async (args) => createInvite(args, ctx),
  );
  server.registerTool(
    'delete_invite',
    {
      title: 'Delete invite',
      description: 'Delete an invite by code or URL. Requires explicit consent ("confirm": true).',
      inputSchema: { code: inviteCodeSchema, confirm: consent },
      annotations: DESTRUCTIVE,
    },
    async (args) => deleteInvite(args, ctx),
  );
};

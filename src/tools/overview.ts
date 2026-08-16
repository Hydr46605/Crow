import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { summarizeBoostInfo } from './boost.js';
import { channelTypeName } from './channel-types.js';
import { summarizeGuild } from './guilds.js';
import { textResult } from './result.js';
import { snowflake } from './schemas.js';

interface OverviewGuild {
  readonly id: string;
  readonly name: string;
  readonly owner_id?: string;
  readonly member_count?: number;
  readonly approximate_member_count?: number;
  readonly approximate_presence_count?: number;
  readonly description?: string | null;
  readonly premium_tier?: number;
  readonly premium_subscription_count?: number;
  readonly premium_progress_bar_enabled?: boolean;
}

interface RawChannel {
  readonly id: string;
  readonly name: string;
  readonly type: number;
  readonly position?: number;
  readonly parent_id?: string | null;
  readonly topic?: string | null;
  readonly nsfw?: boolean;
}

interface RawRole {
  readonly id: string;
  readonly name: string;
  readonly color: number;
  readonly position: number;
  readonly hoist: boolean;
  readonly mentionable: boolean;
  readonly managed: boolean;
}

const summarizeChannelLight = (channel: RawChannel): Record<string, unknown> => ({
  id: channel.id,
  name: channel.name,
  type: channel.type,
  typeName: channelTypeName(channel.type),
  position: channel.position,
  topic: channel.topic,
  nsfw: channel.nsfw,
});

const summarizeRoleLight = (role: RawRole): Record<string, unknown> => ({
  id: role.id,
  name: role.name,
  color: role.color,
  position: role.position,
  hoist: role.hoist,
  mentionable: role.mentionable,
  managed: role.managed,
});

/** Groups channels into categories (plus a top-level list) by parent_id. */
const groupChannels = (
  channels: readonly RawChannel[],
): { categories: unknown[]; channels: unknown[] } => {
  const categories = channels.filter((c) => c.type === 4);
  const categoryIds = new Set(categories.map((c) => c.id));
  const byCategory = new Map<string, RawChannel[]>();
  const topLevel: RawChannel[] = [];

  for (const channel of channels) {
    if (channel.type === 4) continue;
    if (channel.parent_id && categoryIds.has(channel.parent_id)) {
      const list = byCategory.get(channel.parent_id) ?? [];
      list.push(channel);
      byCategory.set(channel.parent_id, list);
    } else {
      topLevel.push(channel);
    }
  }

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      position: c.position,
      channels: (byCategory.get(c.id) ?? []).map(summarizeChannelLight),
    })),
    channels: topLevel.map(summarizeChannelLight),
  };
};

/**
 * Best-effort guild orientation: guild basics and boost info, channels grouped
 * by category, and roles. Any sub-fetch that fails is reported in `errors`
 * rather than failing the whole overview.
 */
export const getGuildOverview = async (
  args: { readonly guildId: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const errors: string[] = [];
  const overview: Record<string, unknown> = {};

  const guild = await attempt('get_guild', () =>
    ctx.discord.request<OverviewGuild>('GET', `/guilds/${args.guildId}`, {
      query: { with_counts: true },
    }),
  );
  if (guild.ok) {
    overview.guild = { ...summarizeGuild(guild.value), ...summarizeBoostInfo(guild.value) };
  } else {
    errors.push(guild.error);
  }

  const channels = await attempt('list_channels', () =>
    ctx.discord.request<RawChannel[]>('GET', `/guilds/${args.guildId}/channels`),
  );
  if (channels.ok) {
    overview.channels = groupChannels(channels.value);
  } else {
    errors.push(channels.error);
  }

  const roles = await attempt('list_roles', () =>
    ctx.discord.request<RawRole[]>('GET', `/guilds/${args.guildId}/roles`),
  );
  if (roles.ok) {
    overview.roles = roles.value.map(summarizeRoleLight);
  } else {
    errors.push(roles.error);
  }

  if (errors.length > 0) overview.errors = errors;
  return textResult(JSON.stringify(overview, null, 2));
};

export const registerOverviewTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'get_guild_overview',
    {
      title: 'Get guild overview',
      description:
        'One-call orientation of a guild: name, member and boost info, channels grouped by category, ' +
        'and roles. Use this when switching context to quickly see what is in a guild. Any section that ' +
        'cannot be read is reported in "errors" instead of failing the whole call.',
      inputSchema: { guildId: snowflake.describe('The ID of the guild to summarize.') },
      annotations: READ_ONLY,
    },
    async (args) => getGuildOverview(args, ctx),
  );
};

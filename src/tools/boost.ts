import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { errorResult, textResult } from './result.js';
import { snowflake } from './schemas.js';

const TIER_NAMES = ['none', 'level1', 'level2', 'level3'] as const;

interface RawBoostGuild {
  readonly premium_tier?: number;
  readonly premium_subscription_count?: number;
  readonly premium_progress_bar_enabled?: boolean;
}

/** Maps a guild's Server Boost fields to a compact, named summary. */
export const summarizeBoostInfo = (guild: RawBoostGuild): Record<string, unknown> => ({
  premiumTier: guild.premium_tier ?? 0,
  level: TIER_NAMES[guild.premium_tier ?? 0] ?? 'none',
  boostCount: guild.premium_subscription_count ?? 0,
  progressBarEnabled: guild.premium_progress_bar_enabled ?? false,
});

export const getBoostInfo = async (
  args: { readonly guildId: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('get_boost_info', () =>
    ctx.discord.request<RawBoostGuild>('GET', `/guilds/${args.guildId}`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeBoostInfo(result.value), null, 2));
};

export const registerBoostTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'get_boost_info',
    {
      title: 'Get boost info',
      description: "Get a guild's Server Boost level, boost count, and progress bar state.",
      inputSchema: { guildId: snowflake.describe('The ID of the guild.') },
      annotations: READ_ONLY,
    },
    async (args) => getBoostInfo(args, ctx),
  );
};

import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { DiscordClient } from '../discord/client.js';
import type { Blocklist } from './types.js';

/** Maps a category name onto the tool annotation predicate it represents. */
export const categoryMatches = (annotations: ToolAnnotations | undefined, category: string): boolean => {
  switch (category) {
    case 'destructive':
      return annotations?.destructiveHint === true;
    case 'open_world':
      return annotations?.openWorldHint === true;
    case 'write':
      return annotations?.readOnlyHint !== true;
    default:
      return false;
  }
};

const segments = (path: string): string[] => path.split('/').filter((segment) => segment.length > 0);

/**
 * Segment glob: `*` matches exactly one path segment and `**` matches any
 * number of segments. Comparison is literal otherwise.
 */
export const routeMatches = (pattern: string, route: string): boolean => {
  const p = segments(pattern);
  const r = segments(route);
  const memo = new Map<string, boolean>();
  const match = (pi: number, ri: number): boolean => {
    const key = `${pi}:${ri}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let result: boolean;
    if (pi === p.length) {
      result = ri === r.length;
    } else if (p[pi] === '**') {
      result = match(pi + 1, ri) || (ri < r.length && match(pi, ri + 1));
    } else {
      result = ri < r.length && (p[pi] === '*' || p[pi] === r[ri]) && match(pi + 1, ri + 1);
    }
    memo.set(key, result);
    return result;
  };
  return match(0, 0);
};

const readString = (args: unknown, keys: readonly string[]): string | undefined => {
  if (typeof args !== 'object' || args === null) return undefined;
  const record = args as Record<string, unknown>;
  for (const key of keys) {
    if (typeof record[key] === 'string') return record[key];
  }
  return undefined;
};

const directGuildId = (args: unknown): string | undefined => readString(args, ['guildId', 'guild_id']);

const channelLikeId = (args: unknown): string | undefined =>
  readString(args, ['channelId', 'channel_id', 'threadId', 'thread_id']);

interface RawChannelRef {
  readonly guild_id?: unknown;
}

/**
 * Evaluates a tool call against the configured blocklist.
 *
 * A call is blocked when any rule matches: by tool name, by category, by raw
 * REST route (discord_request only), or by target guild. Guild rules resolve a
 * channel/thread argument to its guild lazily through a cached channel lookup.
 */
export class BlocklistRuntime {
  private readonly guildCache = new Map<string, string>();

  constructor(
    private readonly blocklist: Blocklist,
    private readonly discord: DiscordClient,
  ) {}

  /** Returns a human-readable reason when the call is blocked, otherwise null. */
  async match(name: string, annotations: ToolAnnotations | undefined, args: unknown): Promise<string | null> {
    if (this.blocklist.tools.includes(name)) {
      return `tool "${name}" is blocked`;
    }
    for (const category of this.blocklist.categories) {
      if (categoryMatches(annotations, category)) {
        return `tool "${name}" is blocked by category "${category}"`;
      }
    }
    const route = this.routeOf(name, args);
    if (route) {
      const rule = this.blocklist.routes.find(
        (candidate) =>
          (candidate.method === '*' || candidate.method === route.method) &&
          routeMatches(candidate.pattern, route.route),
      );
      if (rule) {
        return `route ${route.method} ${route.route} is blocked`;
      }
    }
    if (this.blocklist.guilds.length > 0) {
      const guildId = await this.resolveGuildId(args);
      if (guildId !== undefined && this.blocklist.guilds.includes(guildId)) {
        return `guild ${guildId} is blocked`;
      }
    }
    return null;
  }

  private routeOf(name: string, args: unknown): { method: string; route: string } | undefined {
    if (name !== 'discord_request') return undefined;
    const method = readString(args, ['method']);
    const route = readString(args, ['route']);
    return method && route ? { method: method.toUpperCase(), route } : undefined;
  }

  private async resolveGuildId(args: unknown): Promise<string | undefined> {
    const direct = directGuildId(args);
    if (direct !== undefined) return direct;

    const channelId = channelLikeId(args);
    if (channelId === undefined) return undefined;

    const cached = this.guildCache.get(channelId);
    if (cached !== undefined) return cached;

    try {
      const channel = await this.discord.request<RawChannelRef>('GET', `/channels/${channelId}`);
      if (typeof channel.guild_id === 'string') {
        this.guildCache.set(channelId, channel.guild_id);
        return channel.guild_id;
      }
    } catch {
      // Fail open: a failed lookup must not silently block the call.
    }
    return undefined;
  }
}

import { describe, expect, it } from 'vitest';
import { categoryMatches, BlocklistRuntime, routeMatches } from '../../src/blocklist/runtime.js';
import type { Blocklist } from '../../src/blocklist/types.js';
import { DiscordClient } from '../../src/discord/client.js';

const blocklist = (overrides: Partial<Blocklist>): Blocklist => ({
  tools: [],
  categories: [],
  routes: [],
  guilds: [],
  ...overrides,
});

const runtime = (rules: Blocklist, discord = new DiscordClient('token')) =>
  new BlocklistRuntime(rules, discord);

describe('routeMatches', () => {
  it('matches a single-segment wildcard', () => {
    expect(routeMatches('/channels/*/messages/*', '/channels/1/messages/2')).toBe(true);
    expect(routeMatches('/channels/*/messages/*', '/channels/1/messages')).toBe(false);
  });

  it('matches a double-star across any number of segments', () => {
    expect(routeMatches('/channels/**', '/channels/1/messages/2')).toBe(true);
    expect(routeMatches('/channels/**', '/channels')).toBe(true);
  });

  it('rejects non-matching routes', () => {
    expect(routeMatches('/guilds/*', '/channels/1')).toBe(false);
  });
});

describe('categoryMatches', () => {
  it('maps destructive to the destructive hint', () => {
    expect(categoryMatches({ destructiveHint: true }, 'destructive')).toBe(true);
    expect(categoryMatches({}, 'destructive')).toBe(false);
  });

  it('maps open_world to the open-world hint', () => {
    expect(categoryMatches({ openWorldHint: true }, 'open_world')).toBe(true);
    expect(categoryMatches({}, 'open_world')).toBe(false);
  });

  it('treats write as anything not read-only', () => {
    expect(categoryMatches({ readOnlyHint: true }, 'write')).toBe(false);
    expect(categoryMatches({}, 'write')).toBe(true);
  });
});

describe('BlocklistRuntime.match', () => {
  it('blocks by tool name', async () => {
    const r = runtime(blocklist({ tools: ['delete_channel'] }));
    expect(await r.match('delete_channel', {}, {})).toContain('delete_channel');
    expect(await r.match('read_messages', {}, {})).toBeNull();
  });

  it('blocks by category', async () => {
    const r = runtime(blocklist({ categories: ['destructive'] }));
    expect(await r.match('kick_member', { destructiveHint: true }, {})).toContain('destructive');
    expect(await r.match('read_messages', { readOnlyHint: true }, {})).toBeNull();
  });

  it('blocks a raw REST route for discord_request', async () => {
    const r = runtime(
      blocklist({ routes: [{ method: 'DELETE', pattern: '/channels/*/messages/*' }] }),
    );
    const reason = await r.match('discord_request', {}, {
      method: 'DELETE',
      route: '/channels/1/messages/2',
    });
    expect(reason).toContain('route DELETE /channels/1/messages/2');
  });

  it('lets a non-matching route through', async () => {
    const r = runtime(
      blocklist({ routes: [{ method: 'DELETE', pattern: '/channels/*/messages/*' }] }),
    );
    expect(
      await r.match('discord_request', {}, { method: 'GET', route: '/channels/1/messages/2' }),
    ).toBeNull();
  });

  it('blocks a directly-addressed guild', async () => {
    const r = runtime(blocklist({ guilds: ['1'] }));
    expect(await r.match('send_message', {}, { guildId: '1' })).toContain('guild 1');
  });

  it('resolves a channel to its guild and blocks it', async () => {
    const discord = new DiscordClient('token', async (m, r) => {
      expect(r).toBe('/channels/c1');
      return { guild_id: 'g1' };
    });
    const r = runtime(blocklist({ guilds: ['g1'] }), discord);
    expect(await r.match('send_message', {}, { channelId: 'c1' })).toContain('guild g1');
  });

  it('fails open when a guild lookup errors', async () => {
    const discord = new DiscordClient('token', async () => {
      throw new Error('boom');
    });
    const r = runtime(blocklist({ guilds: ['g1'] }), discord);
    expect(await r.match('send_message', {}, { channelId: 'c1' })).toBeNull();
  });
});

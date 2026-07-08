import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import { getGuild, listGuilds, modifyGuild, summarizeGuild } from '../../src/tools/guilds.js';
import { createContext, textOf, type RecordedRequest } from '../helpers.js';

const rawGuild = {
  id: '123456789012345678',
  name: 'Crow HQ',
  owner_id: '999',
  approximate_member_count: 42,
  approximate_presence_count: 7,
  description: 'Test guild',
};

describe('summarizeGuild', () => {
  it('maps a raw guild to a compact summary', () => {
    expect(summarizeGuild(rawGuild)).toMatchObject({
      id: '123456789012345678',
      name: 'Crow HQ',
      ownerId: '999',
      memberCount: 42,
      presenceCount: 7,
      description: 'Test guild',
    });
  });
});

describe('listGuilds', () => {
  it('requests the current-user guilds route and returns summaries', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (method, route, options) => {
      captured = { method, route, options };
      return [rawGuild];
    });

    const result = await listGuilds(createContext(discord));

    expect(captured).toEqual({
      method: 'GET',
      route: '/users/@me/guilds',
      options: { query: { with_counts: true } },
    });
    expect(textOf(result)).toContain('"name": "Crow HQ"');
  });
});

describe('getGuild', () => {
  it('requests the guild route and returns a summary', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (method, route, options) => {
      captured = { method, route, options };
      return rawGuild;
    });

    await getGuild({ guildId: '123456789012345678' }, createContext(discord));

    expect(captured?.method).toBe('GET');
    expect(captured?.route).toBe('/guilds/123456789012345678');
    expect(captured?.options).toEqual({ query: { with_counts: true } });
  });
});

describe('modifyGuild', () => {
  it('sends only the provided fields', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawGuild;
    });

    await modifyGuild(
      { guildId: 'g', description: 'new desc', rulesChannelId: '777' },
      createContext(discord),
    );

    expect(captured?.m).toBe('PATCH');
    expect(captured?.r).toBe('/guilds/g');
    expect(captured?.o.body).toEqual({ description: 'new desc', rules_channel_id: '777' });
  });
});

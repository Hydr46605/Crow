import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import { getGuildOverview } from '../../src/tools/overview.js';
import { createContext, textOf } from '../helpers.js';

const rawGuild = {
  id: 'g1',
  name: 'Test Guild',
  member_count: 10,
  premium_tier: 2,
  premium_subscription_count: 14,
};

const rawChannels = [
  { id: 'cat1', name: 'Staff', type: 4, position: 0 },
  { id: 'c1', name: 'general', type: 0, position: 1, parent_id: 'cat1' },
  { id: 'c2', name: 'voice', type: 2, position: 2 },
];

const rawRoles = [
  { id: 'r1', name: 'Admin', color: 0, position: 1, hoist: true, mentionable: false, managed: false },
];

describe('getGuildOverview', () => {
  it('aggregates guild, channels (grouped), and roles', async () => {
    const discord = new DiscordClient('token', async (_m, route) => {
      if (route === '/guilds/g1') return rawGuild;
      if (route === '/guilds/g1/channels') return rawChannels;
      if (route === '/guilds/g1/roles') return rawRoles;
      throw new Error(`unexpected route ${route}`);
    });

    const result = await getGuildOverview({ guildId: 'g1' }, createContext(discord));
    const overview = JSON.parse(textOf(result));

    expect(overview.guild).toMatchObject({ id: 'g1', name: 'Test Guild', memberCount: 10, boostCount: 14 });
    expect(overview.channels.categories).toEqual([
      {
        id: 'cat1',
        name: 'Staff',
        position: 0,
        channels: [expect.objectContaining({ id: 'c1', name: 'general', typeName: 'text' })],
      },
    ]);
    expect(overview.channels.channels).toEqual([expect.objectContaining({ id: 'c2', name: 'voice', typeName: 'voice' })]);
    expect(overview.roles).toEqual([expect.objectContaining({ id: 'r1', name: 'Admin' })]);
    expect(overview.errors).toBeUndefined();
  });

  it('reports a failed section in errors without failing the whole call', async () => {
    const discord = new DiscordClient('token', async (_m, route) => {
      if (route === '/guilds/g1') return rawGuild;
      if (route === '/guilds/g1/channels') return rawChannels;
      if (route === '/guilds/g1/roles') throw new Error('forbidden');
      throw new Error(`unexpected route ${route}`);
    });

    const result = await getGuildOverview({ guildId: 'g1' }, createContext(discord));
    const overview = JSON.parse(textOf(result));

    expect(overview.guild.name).toBe('Test Guild');
    expect(overview.channels.categories).toHaveLength(1);
    expect(overview.roles).toBeUndefined();
    expect(overview.errors).toEqual([expect.stringContaining('list_roles failed')]);
  });
});

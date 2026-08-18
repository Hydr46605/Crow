import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import {
  createScheduledEvent,
  deleteScheduledEvent,
  getScheduledEventUsers,
  listScheduledEvents,
  summarizeScheduledEvent,
} from '../../src/tools/scheduled-events.js';
import { createContext, textOf, type RecordedRequest } from '../helpers.js';

const rawEvent = {
  id: 'e1',
  guild_id: 'g1',
  channel_id: 'vc1',
  creator_id: 'c1',
  name: 'Game night',
  description: 'fun',
  scheduled_start_time: '2026-09-01T18:00:00Z',
  scheduled_end_time: '2026-09-01T20:00:00Z',
  privacy_level: 2,
  status: 1,
  entity_type: 2,
  entity_id: 'vc1',
  entity_metadata: null,
  user_count: 3,
};

describe('summarizeScheduledEvent', () => {
  it('decodes a raw scheduled event', () => {
    expect(summarizeScheduledEvent(rawEvent)).toEqual({
      id: 'e1',
      guildId: 'g1',
      channelId: 'vc1',
      creatorId: 'c1',
      name: 'Game night',
      description: 'fun',
      scheduledStartTime: '2026-09-01T18:00:00Z',
      scheduledEndTime: '2026-09-01T20:00:00Z',
      privacyLevel: 2,
      status: 'scheduled',
      entityType: 'voice',
      entityId: 'vc1',
      entityMetadata: null,
      userCount: 3,
    });
  });
});

describe('listScheduledEvents', () => {
  it('requests the scheduled events route', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return [rawEvent];
    });

    const result = await listScheduledEvents({ guildId: 'g' }, createContext(discord));

    expect(captured?.r).toBe('/guilds/g/scheduled-events');
    expect(textOf(result)).toContain('Game night');
  });
});

describe('createScheduledEvent', () => {
  it('posts a voice event with guild-only privacy', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawEvent;
    });

    await createScheduledEvent(
      {
        guildId: 'g',
        name: 'Game night',
        entityType: 'voice',
        scheduledStartTime: '2026-09-01T18:00:00Z',
        channelId: 'vc1',
      },
      createContext(discord),
    );

    expect(captured?.m).toBe('POST');
    expect(captured?.r).toBe('/guilds/g/scheduled-events');
    expect(captured?.o.body).toEqual({
      channel_id: 'vc1',
      name: 'Game night',
      entity_type: 2,
      scheduled_start_time: '2026-09-01T18:00:00Z',
      privacy_level: 2,
    });
  });

  it('posts an external event with a location', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawEvent;
    });

    await createScheduledEvent(
      {
        guildId: 'g',
        name: 'Meetup',
        entityType: 'external',
        scheduledStartTime: '2026-09-01T18:00:00Z',
        location: 'Rome',
      },
      createContext(discord),
    );

    expect(captured?.o.body).toEqual({
      name: 'Meetup',
      entity_type: 3,
      scheduled_start_time: '2026-09-01T18:00:00Z',
      entity_metadata: { location: 'Rome' },
      privacy_level: 2,
    });
  });
});

describe('deleteScheduledEvent', () => {
  it('requires consent', async () => {
    const discord = new DiscordClient('token', async () => {
      throw new Error('should not run');
    });
    const result = await deleteScheduledEvent({ guildId: 'g', eventId: 'e1' }, createContext(discord));
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('consent');
  });
});

describe('getScheduledEventUsers', () => {
  it('requests the users route and summarizes', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return [{ user: { id: 'u1', username: 'alice', discriminator: '0' } }];
    });

    const result = await getScheduledEventUsers(
      { guildId: 'g', eventId: 'e1', limit: 10 },
      createContext(discord),
    );

    expect(captured?.r).toBe('/guilds/g/scheduled-events/e1/users');
    expect(captured?.o.query?.limit).toBe(10);
    expect(textOf(result)).toContain('alice');
  });
});

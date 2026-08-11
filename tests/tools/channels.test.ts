import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import {
  createChannel,
  deleteChannel,
  getChannel,
  listChannels,
  modifyChannel,
  summarizeChannel,
} from '../../src/tools/channels.js';
import { createContext, textOf, type RecordedRequest } from '../helpers.js';

const rawChannel = {
  id: '1',
  name: 'general',
  type: 0,
  topic: 'chat',
  nsfw: false,
  position: 1,
  parent_id: '9',
  rate_limit_per_user: 5,
};

describe('summarizeChannel', () => {
  it('maps a raw channel to a compact summary', () => {
    expect(summarizeChannel(rawChannel)).toMatchObject({
      id: '1',
      name: 'general',
      type: 0,
      topic: 'chat',
      nsfw: false,
      position: 1,
      parentId: '9',
      slowmodeSeconds: 5,
    });
  });
});

describe('listChannels', () => {
  it('requests the guild channels route and returns summaries', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return [rawChannel];
    });

    const result = await listChannels({ guildId: 'g' }, createContext(discord));

    expect(captured?.r).toBe('/guilds/g/channels');
    expect(textOf(result)).toContain('"name": "general"');
  });
});

describe('getChannel', () => {
  it('requests the single-channel route', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawChannel;
    });

    await getChannel({ channelId: '1' }, createContext(discord));

    expect(captured?.r).toBe('/channels/1');
  });
});

describe('modifyChannel', () => {
  it('sends only the provided fields', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawChannel;
    });

    await modifyChannel(
      { channelId: '1', name: 'renamed', nsfw: true, slowmodeSeconds: 30 },
      createContext(discord),
    );

    expect(captured?.m).toBe('PATCH');
    expect(captured?.r).toBe('/channels/1');
    expect(captured?.o.body).toEqual({ name: 'renamed', nsfw: true, rate_limit_per_user: 30 });
  });
});

describe('createChannel', () => {
  it('maps the type code and sends the body', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawChannel;
    });

    await createChannel({ guildId: 'g', name: 'x', type: 'forum', topic: 't' }, createContext(discord));

    expect(captured?.m).toBe('POST');
    expect(captured?.r).toBe('/guilds/g/channels');
    expect(captured?.o.body).toEqual({ name: 'x', type: 15, topic: 't' });
  });

  it('defaults to a text channel', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawChannel;
    });

    await createChannel({ guildId: 'g', name: 'x' }, createContext(discord));

    expect(captured?.o.body).toEqual({ name: 'x', type: 0 });
  });
});

describe('deleteChannel', () => {
  it('requires consent', async () => {
    const discord = new DiscordClient('token', async () => {
      throw new Error('should not run');
    });
    const result = await deleteChannel({ channelId: '1' }, createContext(discord));
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('consent');
  });

  it('deletes with consent', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return null;
    });

    const result = await deleteChannel({ channelId: '1', confirm: true }, createContext(discord));

    expect(captured?.m).toBe('DELETE');
    expect(captured?.r).toBe('/channels/1');
    expect(textOf(result)).toContain('Deleted channel 1');
  });
});

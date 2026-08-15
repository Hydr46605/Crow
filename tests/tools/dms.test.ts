import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import { getDmChannel, listDmChannels, readDmMessages, sendDm, summarizeDmChannel } from '../../src/tools/dms.js';
import { createContext, textOf, type RecordedRequest } from '../helpers.js';

describe('summarizeDmChannel', () => {
  it('maps recipients and the type name', () => {
    expect(
      summarizeDmChannel({
        id: '1',
        type: 3,
        recipients: [{ id: 'u1', username: 'alice', global_name: 'Alice' }],
        last_message_id: 'm1',
      }),
    ).toEqual({
      id: '1',
      type: 3,
      typeName: 'groupDm',
      recipients: [{ id: 'u1', username: 'alice', globalName: 'Alice' }],
      lastMessageId: 'm1',
    });
  });

  it('defaults a direct message to typeName dm', () => {
    expect(summarizeDmChannel({ id: '2', type: 1 }).typeName).toBe('dm');
  });
});

describe('listDmChannels', () => {
  it('requests the DM channels route and returns recipient summaries', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return [{ id: '1', type: 1, recipients: [{ id: 'u1', username: 'alice' }] }];
    });

    const result = await listDmChannels(createContext(discord));

    expect(captured?.r).toBe('/users/@me/channels');
    expect(textOf(result)).toContain('"username": "alice"');
  });
});

describe('sendDm', () => {
  it('resolves the DM channel then sends the message', async () => {
    const routes: string[] = [];
    const discord = new DiscordClient('token', async (m, r) => {
      routes.push(r);
      if (r === '/users/@me/channels') {
        return { id: 'dm1', type: 1, recipients: [{ id: 'u1', username: 'alice' }] };
      }
      return {
        id: 'm1',
        channel_id: 'dm1',
        author: { id: 'bot', username: 'crow' },
        content: 'hi',
        timestamp: '2026-01-01T00:00:00.000000+00:00',
      };
    });

    const result = await sendDm({ userId: 'u1', content: 'hi' }, createContext(discord));

    expect(routes).toEqual(['/users/@me/channels', '/channels/dm1/messages']);
    expect(textOf(result)).toContain('"content": "hi"');
  });

  it('sends embeds through the shared message body', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      if (r === '/users/@me/channels') return { id: 'dm1', type: 1 };
      return {
        id: 'm1',
        channel_id: 'dm1',
        author: { id: 'b', username: 'c' },
        content: '',
        timestamp: 't',
      };
    });

    await sendDm({ userId: 'u1', embeds: [{ title: 'T' }] }, createContext(discord));

    expect(captured?.r).toBe('/channels/dm1/messages');
    expect(captured?.o.body).toMatchObject({ embeds: [{ title: 'T' }] });
  });
});

describe('getDmChannel', () => {
  it('resolves the DM channel for a user', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return { id: 'dm1', type: 1, recipients: [{ id: 'u1', username: 'alice' }] };
    });

    const result = await getDmChannel({ userId: 'u1' }, createContext(discord));

    expect(captured?.r).toBe('/users/@me/channels');
    expect(captured?.o.body).toEqual({ recipient_id: 'u1' });
    expect(textOf(result)).toContain('"id": "dm1"');
  });
});

describe('readDmMessages', () => {
  it('resolves by user then reads the messages', async () => {
    const routes: string[] = [];
    const discord = new DiscordClient('token', async (m, r) => {
      routes.push(r);
      if (r === '/users/@me/channels') return { id: 'dm1', type: 1 };
      return [
        { id: 'm1', channel_id: 'dm1', author: { id: 'u1', username: 'alice' }, content: 'hi', timestamp: 't' },
      ];
    });

    const result = await readDmMessages({ userId: 'u1', limit: 10 }, createContext(discord));

    expect(routes).toEqual(['/users/@me/channels', '/channels/dm1/messages']);
    expect(textOf(result)).toContain('"content": "hi"');
  });

  it('reads directly from a channel id', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return [];
    });

    await readDmMessages({ channelId: 'dm9' }, createContext(discord));

    expect(captured?.r).toBe('/channels/dm9/messages');
  });
});

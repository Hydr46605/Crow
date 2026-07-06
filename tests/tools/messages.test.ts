import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import { readMessages, sendMessage, summarizeMessage } from '../../src/tools/messages.js';
import { createContext, textOf, type RecordedRequest } from '../helpers.js';

const rawMessage = {
  id: '1',
  channel_id: '123456789012345678',
  author: { id: '999', username: 'hydra' },
  content: 'hello',
  timestamp: '2026-08-16T00:00:00.000Z',
};

describe('summarizeMessage', () => {
  it('maps a raw message to a compact summary', () => {
    expect(summarizeMessage(rawMessage)).toEqual({
      id: '1',
      channelId: '123456789012345678',
      authorId: '999',
      authorUsername: 'hydra',
      content: 'hello',
      createdAt: '2026-08-16T00:00:00.000Z',
    });
  });
});

describe('readMessages', () => {
  it('requests the channel messages route and returns summaries', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (method, route, options) => {
      captured = { method, route, options };
      return [rawMessage];
    });

    const result = await readMessages(
      { channelId: '123456789012345678', limit: 10 },
      createContext(discord),
    );

    expect(captured?.method).toBe('GET');
    expect(captured?.route).toBe('/channels/123456789012345678/messages');
    expect(captured?.options.query?.limit).toBe(10);
    expect(textOf(result)).toContain('"authorUsername": "hydra"');
  });
});

describe('sendMessage', () => {
  it('posts content with a reply reference when given', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (method, route, options) => {
      captured = { method, route, options };
      return rawMessage;
    });

    await sendMessage(
      { channelId: '123456789012345678', content: 'hi', replyTo: '555' },
      createContext(discord),
    );

    expect(captured?.method).toBe('POST');
    expect(captured?.route).toBe('/channels/123456789012345678/messages');
    expect(captured?.options.body).toEqual({ content: 'hi', message_reference: { message_id: '555' } });
  });

  it('omits the reply reference when not given', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (method, route, options) => {
      captured = { method, route, options };
      return rawMessage;
    });

    await sendMessage({ channelId: '123456789012345678', content: 'hi' }, createContext(discord));

    expect(captured?.options.body).toEqual({ content: 'hi' });
  });

  it('returns an error result when the request fails', async () => {
    const discord = new DiscordClient('token', async () => {
      throw new Error('boom');
    });

    const result = await sendMessage(
      { channelId: '123456789012345678', content: 'hi' },
      createContext(discord),
    );

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe('boom');
  });
});

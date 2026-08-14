import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import {
  addReaction,
  listReactions,
  removeOwnReaction,
  removeUserReaction,
  summarizeReactionUser,
} from '../../src/tools/reactions.js';
import { createContext, textOf, type RecordedRequest } from '../helpers.js';

describe('reaction routes', () => {
  it('URL-encodes a unicode emoji', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return null;
    });

    await addReaction({ channelId: 'c', messageId: 'm', emoji: '👍' }, createContext(discord));

    expect(captured?.m).toBe('PUT');
    expect(captured?.r).toBe('/channels/c/messages/m/reactions/%F0%9F%91%8D/@me');
  });

  it('passes a custom name:id emoji through', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return null;
    });

    await removeUserReaction(
      { channelId: 'c', messageId: 'm', emoji: 'party:123456789012345678', userId: 'u' },
      createContext(discord),
    );

    expect(captured?.r).toBe('/channels/c/messages/m/reactions/party%3A123456789012345678/u');
  });

  it('removes the own reaction via the @me route', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return null;
    });

    await removeOwnReaction({ channelId: 'c', messageId: 'm', emoji: '👍' }, createContext(discord));

    expect(captured?.m).toBe('DELETE');
    expect(captured?.r).toBe('/channels/c/messages/m/reactions/%F0%9F%91%8D/@me');
  });

  it('lists reactions without a trailing target', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return [{ id: '1', username: 'a', discriminator: '0', bot: false }];
    });

    const result = await listReactions(
      { channelId: 'c', messageId: 'm', emoji: '👍', limit: 5 },
      createContext(discord),
    );

    expect(captured?.r).toBe('/channels/c/messages/m/reactions/%F0%9F%91%8D');
    expect(captured?.o.query).toEqual({ limit: 5, after: undefined });
    expect(textOf(result)).toContain('"username": "a"');
  });
});

describe('summarizeReactionUser', () => {
  it('maps a raw user to a compact summary', () => {
    expect(summarizeReactionUser({ id: '1', username: 'a', discriminator: '0', bot: true })).toEqual({
      userId: '1',
      username: 'a',
      discriminator: '0',
      bot: true,
    });
  });
});

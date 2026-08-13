import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import {
  createEmoji,
  deleteEmoji,
  getEmoji,
  listEmojis,
  modifyEmoji,
  summarizeEmoji,
} from '../../src/tools/emojis.js';
import { createContext, textOf, type RecordedRequest } from '../helpers.js';

const rawEmoji = {
  id: 'e1',
  name: 'wave',
  roles: ['r1'],
  animated: true,
  available: true,
  managed: false,
  require_colons: true,
};

describe('summarizeEmoji', () => {
  it('maps a raw emoji to a summary', () => {
    expect(summarizeEmoji(rawEmoji)).toEqual({
      id: 'e1',
      name: 'wave',
      animated: true,
      available: true,
      managed: false,
      requireColons: true,
      roles: ['r1'],
    });
  });
});

describe('listEmojis / getEmoji', () => {
  it('requests the correct routes', async () => {
    const routes: string[] = [];
    const discord = new DiscordClient('token', async (m, r) => {
      routes.push(`${m} ${r}`);
      return m === 'GET' && r.endsWith('/emojis') ? [rawEmoji] : rawEmoji;
    });
    await listEmojis({ guildId: 'g1' }, createContext(discord));
    await getEmoji({ guildId: 'g1', emojiId: 'e1' }, createContext(discord));
    expect(routes).toEqual(['GET /guilds/g1/emojis', 'GET /guilds/g1/emojis/e1']);
  });
});

describe('createEmoji', () => {
  it('passes a data URI string through unchanged', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, options: o };
      return rawEmoji;
    });
    await createEmoji(
      { guildId: 'g1', name: 'wave', image: 'data:image/png;base64,aGVsbG8=' },
      createContext(discord),
    );
    expect(captured?.r).toBe('/guilds/g1/emojis');
    expect(captured?.options.body).toEqual({ name: 'wave', image: 'data:image/png;base64,aGVsbG8=', roles: undefined });
  });

  it('converts a file source to a data URI', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, options: o };
      return rawEmoji;
    });
    await createEmoji(
      { guildId: 'g1', name: 'wave', image: { name: 'x.png', data: 'aGVsbG8=' } },
      createContext(discord),
    );
    const body = captured?.options.body as { image: string };
    expect(body.image).toBe('data:image/png;base64,aGVsbG8=');
  });
});

describe('modifyEmoji', () => {
  it('patches only the provided fields', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, options: o };
      return rawEmoji;
    });
    await modifyEmoji({ guildId: 'g1', emojiId: 'e1', name: 'renamed' }, createContext(discord));
    expect(captured?.r).toBe('/guilds/g1/emojis/e1');
    expect(captured?.options.body).toEqual({ name: 'renamed' });
  });
});

describe('deleteEmoji', () => {
  it('requires consent', async () => {
    const discord = new DiscordClient('token', async () => {
      throw new Error('should not run');
    });
    const result = await deleteEmoji({ guildId: 'g1', emojiId: 'e1' }, createContext(discord));
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('consent');
  });

  it('deletes with consent', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r) => {
      captured = { m, r, options: {} };
      return null;
    });
    const result = await deleteEmoji({ guildId: 'g1', emojiId: 'e1', confirm: true }, createContext(discord));
    expect(captured?.r).toBe('/guilds/g1/emojis/e1');
    expect(textOf(result)).toContain('Deleted emoji e1');
  });
});

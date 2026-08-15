import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import { getCurrentUser, modifyCurrentUser, summarizeCurrentUser } from '../../src/tools/profile.js';
import { createContext, type RecordedRequest } from '../helpers.js';

describe('summarizeCurrentUser', () => {
  it('maps the current-user fields, defaulting nulls', () => {
    expect(
      summarizeCurrentUser({
        id: 'bot1',
        username: 'crow',
        global_name: 'Crow',
        avatar: 'abc',
        banner: null,
        bio: 'hi',
        accent_color: 16711680,
      }),
    ).toEqual({
      id: 'bot1',
      username: 'crow',
      globalName: 'Crow',
      avatar: 'abc',
      banner: null,
      bio: 'hi',
      accentColor: 16711680,
    });
  });
});

describe('getCurrentUser', () => {
  it('requests the current-user route', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return { id: 'bot1', username: 'crow' };
    });

    await getCurrentUser(createContext(discord));

    expect(captured?.r).toBe('/users/@me');
  });
});

describe('modifyCurrentUser', () => {
  it('patches only the provided fields', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return { id: 'bot1', username: 'crow' };
    });

    await modifyCurrentUser({ bio: 'new bio' }, createContext(discord));

    expect(captured?.m).toBe('PATCH');
    expect(captured?.r).toBe('/users/@me');
    expect(captured?.o.body).toEqual({ bio: 'new bio' });
  });

  it('converts a file-source avatar to a data URI', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return { id: 'bot1', username: 'crow' };
    });
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    await modifyCurrentUser({ avatar: { name: 'a.png', data: png } }, createContext(discord));

    expect((captured?.o.body as { avatar: string }).avatar).toContain('data:image/png;base64,');
  });
});

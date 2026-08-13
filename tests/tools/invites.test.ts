import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import {
  createInvite,
  deleteInvite,
  getInvite,
  getVanityUrl,
  listChannelInvites,
  listGuildInvites,
  normalizeInviteCode,
} from '../../src/tools/invites.js';
import { createContext, textOf, type RecordedRequest } from '../helpers.js';

describe('normalizeInviteCode', () => {
  it('accepts a bare code', () => {
    expect(normalizeInviteCode('AbCd123')).toBe('AbCd123');
  });

  it('extracts the code from a discord.gg URL', () => {
    expect(normalizeInviteCode('https://discord.gg/AbCd123')).toBe('AbCd123');
  });

  it('extracts the code from a discord.com/invite URL', () => {
    expect(normalizeInviteCode('https://discord.com/invite/AbCd123?event=1')).toBe('AbCd123');
  });

  it('rejects an invalid code', () => {
    expect(() => normalizeInviteCode('not a code!')).toThrow('Invalid invite code');
  });
});

describe('listGuildInvites', () => {
  it('requests the guild invites route', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r) => {
      captured = { m, r, options: {} };
      return [{ code: 'c1' }];
    });
    await listGuildInvites({ guildId: 'g1' }, createContext(discord));
    expect(captured?.r).toBe('/guilds/g1/invites');
  });
});

describe('listChannelInvites', () => {
  it('requests the channel invites route', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r) => {
      captured = { m, r, options: {} };
      return [];
    });
    await listChannelInvites({ channelId: 'c1' }, createContext(discord));
    expect(captured?.r).toBe('/channels/c1/invites');
  });
});

describe('getInvite', () => {
  it('normalizes the code and forwards counts/expiration flags', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, options: o };
      return { code: 'AbCd123' };
    });
    await getInvite({ code: 'https://discord.gg/AbCd123', withCounts: true }, createContext(discord));
    expect(captured?.r).toBe('/invites/AbCd123');
    expect(captured?.options.query).toEqual({ with_counts: true, with_expiration: undefined });
  });
});

describe('getVanityUrl', () => {
  it('requests the vanity URL route', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r) => {
      captured = { m, r, options: {} };
      return { code: 'vanity', uses: 5 };
    });
    const result = await getVanityUrl({ guildId: 'g1' }, createContext(discord));
    expect(captured?.r).toBe('/guilds/g1/vanity-url');
    expect(textOf(result)).toContain('vanity');
  });
});

describe('createInvite', () => {
  it('maps friendly fields to the snake_case body', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, options: o };
      return { code: 'new' };
    });
    await createInvite(
      {
        channelId: 'c1',
        maxAge: 3600,
        maxUses: 10,
        temporary: true,
        unique: true,
        targetType: 'embeddedApplication',
        targetApplicationId: '123456789012345678',
      },
      createContext(discord),
    );
    expect(captured?.r).toBe('/channels/c1/invites');
    expect(captured?.options.body).toEqual({
      max_age: 3600,
      max_uses: 10,
      temporary: true,
      unique: true,
      target_type: 2,
      target_application_id: '123456789012345678',
    });
  });

  it('maps a stream invite target type', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, options: o };
      return { code: 'new' };
    });
    await createInvite(
      { channelId: 'c1', targetType: 'stream', targetUserId: '123456789012345678' },
      createContext(discord),
    );
    expect(captured?.options.body).toEqual({ target_type: 1, target_user_id: '123456789012345678' });
  });
});

describe('deleteInvite', () => {
  it('requires consent', async () => {
    const discord = new DiscordClient('token', async () => {
      throw new Error('should not run');
    });
    const result = await deleteInvite({ code: 'AbCd123' }, createContext(discord));
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('consent');
  });

  it('deletes with consent', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r) => {
      captured = { m, r, options: {} };
      return null;
    });
    const result = await deleteInvite({ code: 'https://discord.gg/AbCd123', confirm: true }, createContext(discord));
    expect(captured?.r).toBe('/invites/AbCd123');
    expect(textOf(result)).toContain('Deleted invite');
  });
});

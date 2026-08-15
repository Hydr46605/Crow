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
  summarizeInvite,
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

describe('summarizeInvite', () => {
  it('maps the current invite fields including type, id, and profile counts', () => {
    const summary = summarizeInvite({
      code: 'AbCd123',
      type: 0,
      id: '1538653018394861608',
      guild_id: 'g1',
      guild: { id: 'g1', name: 'Guild' },
      channel: { id: 'c1', name: 'Channel', type: 0 },
      inviter: { id: 'u1', username: 'inviter' },
      uses: 3,
      max_uses: 5,
      max_age: 3600,
      temporary: false,
      created_at: '2026-08-16T20:57:46.369708+00:00',
      expires_at: '2026-08-16T21:57:46+00:00',
      profile: { member_count: 19, online_count: 6 },
      approximate_member_count: 19,
      approximate_presence_count: 6,
    });
    expect(summary).toEqual({
      code: 'AbCd123',
      inviteId: '1538653018394861608',
      type: 0,
      guildId: 'g1',
      guildName: 'Guild',
      channelId: 'c1',
      channelName: 'Channel',
      inviterId: 'u1',
      uses: 3,
      maxUses: 5,
      maxAge: 3600,
      temporary: false,
      createdAt: '2026-08-16T20:57:46.369708+00:00',
      expiresAt: '2026-08-16T21:57:46+00:00',
      memberCount: 19,
      onlineCount: 6,
      approximateMemberCount: 19,
      approximatePresenceCount: 6,
    });
  });

  it('falls back to the nested guild id when guild_id is absent', () => {
    expect(summarizeInvite({ code: 'X', guild: { id: 'g2', name: 'G' } }).guildId).toBe('g2');
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

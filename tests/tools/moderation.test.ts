import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import {
  banMember,
  deleteMessageSeconds,
  getBan,
  kickMember,
  listBans,
  summarizeBan,
  unbanMember,
} from '../../src/tools/moderation.js';
import { createContext, textOf, type RecordedRequest } from '../helpers.js';

const rawBan = {
  reason: 'spam',
  user: { id: '555', username: 'alice', discriminator: '0' },
};

describe('summarizeBan', () => {
  it('maps a raw ban to a compact summary', () => {
    expect(summarizeBan(rawBan)).toEqual({
      userId: '555',
      username: 'alice',
      discriminator: '0',
      reason: 'spam',
    });
  });
});

describe('deleteMessageSeconds', () => {
  it('converts days to seconds and defaults to zero', () => {
    expect(deleteMessageSeconds(undefined)).toBe(0);
    expect(deleteMessageSeconds(0)).toBe(0);
    expect(deleteMessageSeconds(2)).toBe(172800);
  });
});

describe('kickMember', () => {
  it('requires consent', async () => {
    const discord = new DiscordClient('token', async () => {
      throw new Error('should not run');
    });
    const result = await kickMember({ guildId: 'g', userId: 'u' }, createContext(discord));
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('consent');
  });

  it('kicks with consent and a reason', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return null;
    });

    const result = await kickMember(
      { guildId: 'g', userId: 'u', confirm: true, reason: 'spam' },
      createContext(discord),
    );

    expect(captured?.m).toBe('DELETE');
    expect(captured?.r).toBe('/guilds/g/members/u');
    expect(captured?.o).toEqual({ reason: 'spam' });
    expect(textOf(result)).toContain('Kicked');
  });
});

describe('banMember', () => {
  it('sends delete_message_seconds and the reason', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return null;
    });

    await banMember(
      { guildId: 'g', userId: 'u', confirm: true, deleteMessageDays: 2, reason: 'x' },
      createContext(discord),
    );

    expect(captured?.m).toBe('PUT');
    expect(captured?.r).toBe('/guilds/g/bans/u');
    expect(captured?.o.body).toEqual({ delete_message_seconds: 172800 });
    expect(captured?.o.reason).toBe('x');
  });

  it('blocks without consent', async () => {
    const discord = new DiscordClient('token', async () => {
      throw new Error('should not run');
    });
    const result = await banMember({ guildId: 'g', userId: 'u' }, createContext(discord));
    expect(result.isError).toBe(true);
  });
});

describe('unbanMember', () => {
  it('unbans without consent', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return null;
    });

    const result = await unbanMember(
      { guildId: 'g', userId: 'u', reason: 'x' },
      createContext(discord),
    );

    expect(captured?.m).toBe('DELETE');
    expect(captured?.r).toBe('/guilds/g/bans/u');
    expect(textOf(result)).toContain('Unbanned');
  });
});

describe('ban listing', () => {
  it('lists bans', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return [rawBan];
    });

    const result = await listBans({ guildId: 'g', limit: 10 }, createContext(discord));

    expect(captured?.r).toBe('/guilds/g/bans');
    expect(captured?.o.query?.limit).toBe(10);
    expect(textOf(result)).toContain('"username": "alice"');
  });

  it('gets a single ban', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawBan;
    });

    await getBan({ guildId: 'g', userId: 'u' }, createContext(discord));

    expect(captured?.r).toBe('/guilds/g/bans/u');
  });
});

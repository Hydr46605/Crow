import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import {
  addRoleToMember,
  getMember,
  listMembers,
  modifyMember,
  removeRoleFromMember,
  summarizeMember,
} from '../../src/tools/members.js';
import { createContext, textOf, type RecordedRequest } from '../helpers.js';

const rawMember = {
  user: { id: '555', username: 'alice', discriminator: '0', bot: false },
  nick: 'Alice',
  roles: ['111'],
  joined_at: '2026-08-16T00:00:00.000Z',
  pending: false,
};

describe('summarizeMember', () => {
  it('maps a raw member to a compact summary', () => {
    expect(summarizeMember(rawMember)).toMatchObject({
      userId: '555',
      username: 'alice',
      discriminator: '0',
      bot: false,
      nickname: 'Alice',
      roles: ['111'],
      joinedAt: '2026-08-16T00:00:00.000Z',
      pending: false,
    });
  });
});

describe('listMembers', () => {
  it('requests the guild members route with filters', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (method, route, options) => {
      captured = { method, route, options };
      return [rawMember];
    });

    const result = await listMembers(
      { guildId: '123456789012345678', query: 'al', limit: 50 },
      createContext(discord),
    );

    expect(captured?.method).toBe('GET');
    expect(captured?.route).toBe('/guilds/123456789012345678/members');
    expect(captured?.options.query).toEqual({ limit: 50, after: undefined, query: 'al' });
    expect(textOf(result)).toContain('"username": "alice"');
  });
});

describe('getMember', () => {
  it('requests the single-member route', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (method, route, options) => {
      captured = { method, route, options };
      return rawMember;
    });

    await getMember(
      { guildId: '123456789012345678', userId: '555' },
      createContext(discord),
    );

    expect(captured?.route).toBe('/guilds/123456789012345678/members/555');
  });
});

describe('modifyMember', () => {
  it('patches only the provided member fields', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (method, route, options) => {
      captured = { method, route, options };
      return null;
    });

    await modifyMember(
      { guildId: 'g', userId: 'u', nick: 'New', timeoutUntil: '2026-09-01T00:00:00.000Z' },
      createContext(discord),
    );

    expect(captured?.method).toBe('PATCH');
    expect(captured?.route).toBe('/guilds/g/members/u');
    expect(captured?.options.body).toEqual({
      nick: 'New',
      communication_disabled_until: '2026-09-01T00:00:00.000Z',
    });
  });

  it('sends null to clear a nickname or timeout', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (method, route, options) => {
      captured = { method, route, options };
      return null;
    });

    await modifyMember(
      { guildId: 'g', userId: 'u', nick: null, timeoutUntil: null },
      createContext(discord),
    );

    expect(captured?.options.body).toEqual({ nick: null, communication_disabled_until: null });
  });
});

describe('member role assignment', () => {
  it('puts and deletes the member role routes', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (method, route, options) => {
      captured = { method, route, options };
      return null;
    });

    await addRoleToMember({ guildId: 'g', userId: 'u', roleId: 'r' }, createContext(discord));
    expect(captured?.method).toBe('PUT');
    expect(captured?.route).toBe('/guilds/g/members/u/roles/r');

    await removeRoleFromMember({ guildId: 'g', userId: 'u', roleId: 'r' }, createContext(discord));
    expect(captured?.method).toBe('DELETE');
    expect(captured?.route).toBe('/guilds/g/members/u/roles/r');
  });
});

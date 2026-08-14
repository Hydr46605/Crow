import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import {
  createRole,
  deleteRole,
  listRoles,
  modifyRole,
  modifyRoleInput,
  summarizeRole,
} from '../../src/tools/roles.js';
import { createContext, textOf, type RecordedRequest } from '../helpers.js';

const rawRole = {
  id: '1',
  name: 'Admin',
  color: 0,
  hoist: false,
  position: 1,
  permissions: '8',
  managed: false,
  mentionable: false,
};

describe('summarizeRole', () => {
  it('maps a raw role to a summary with named permissions', () => {
    expect(summarizeRole(rawRole)).toEqual({
      id: '1',
      name: 'Admin',
      color: 0,
      hoist: false,
      position: 1,
      permissions: ['ADMINISTRATOR'],
      managed: false,
      mentionable: false,
    });
  });
});

describe('listRoles', () => {
  it('requests the guild roles route', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return [rawRole];
    });

    const result = await listRoles({ guildId: '123456789012345678' }, createContext(discord));

    expect(captured?.r).toBe('/guilds/123456789012345678/roles');
    expect(textOf(result)).toContain('"name": "Admin"');
  });
});

describe('createRole', () => {
  it('posts the role body with named permissions and hex color', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawRole;
    });

    await createRole(
      {
        guildId: 'g',
        name: 'Mod',
        permissions: ['KICK_MEMBERS', 'BAN_MEMBERS'],
        color: '#ff0000',
        hoist: true,
        reason: 'r',
      },
      createContext(discord),
    );

    expect(captured?.m).toBe('POST');
    expect(captured?.r).toBe('/guilds/g/roles');
    expect(captured?.o.body).toEqual({ name: 'Mod', permissions: '6', color: 16711680, hoist: true });
    expect(captured?.o.reason).toBe('r');
  });
});

describe('modifyRole', () => {
  it('patches the role route', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawRole;
    });

    await modifyRole({ guildId: 'g', roleId: '9', mentionable: true }, createContext(discord));

    expect(captured?.m).toBe('PATCH');
    expect(captured?.r).toBe('/guilds/g/roles/9');
    expect(captured?.o.body).toEqual({ mentionable: true });
  });
});

describe('modifyRoleInput', () => {
  it('requires at least one modifier field', () => {
    expect(modifyRoleInput.safeParse({ guildId: '123456789012345678', roleId: '123456789012345678' }).success).toBe(false);
    expect(
      modifyRoleInput.safeParse({ guildId: '123456789012345678', roleId: '123456789012345678', name: 'x' })
        .success,
    ).toBe(true);
  });
});

describe('deleteRole', () => {
  it('requires consent', async () => {
    const discord = new DiscordClient('token', async () => {
      throw new Error('should not run');
    });
    const result = await deleteRole({ guildId: 'g', roleId: '9' }, createContext(discord));
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('consent');
  });

  it('deletes with consent', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return null;
    });

    const result = await deleteRole(
      { guildId: 'g', roleId: '9', confirm: true },
      createContext(discord),
    );

    expect(captured?.m).toBe('DELETE');
    expect(captured?.r).toBe('/guilds/g/roles/9');
    expect(textOf(result)).toContain('Deleted role 9');
  });
});

import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import {
  createAutomodRule,
  deleteAutomodRule,
  getAutomodRule,
  listAutomodRules,
  summarizeAutomodRule,
} from '../../src/tools/automod.js';
import { createContext, textOf, type RecordedRequest } from '../helpers.js';

const rawRule = {
  id: 'r1',
  guild_id: 'g1',
  name: 'Keyword filter',
  creator_id: 'c1',
  event_type: 1,
  trigger_type: 1,
  trigger_metadata: { keyword_filter: ['bad'] },
  actions: [{ type: 1, metadata: { custom_message: 'no' } }],
  enabled: true,
  exempt_roles: ['r'],
  exempt_channels: ['c'],
};

describe('summarizeAutomodRule', () => {
  it('decodes a raw automod rule', () => {
    expect(summarizeAutomodRule(rawRule)).toEqual({
      id: 'r1',
      guildId: 'g1',
      name: 'Keyword filter',
      creatorId: 'c1',
      eventType: 'messageSend',
      triggerType: 'keyword',
      triggerMetadata: {
        keywordFilter: ['bad'],
        regexPatterns: undefined,
        allowList: undefined,
        presets: undefined,
        mentionTotalLimit: undefined,
        mentionRaidProtectionEnabled: undefined,
      },
      actions: [{ type: 'blockMessage', customMessage: 'no', channelId: undefined, durationSeconds: undefined }],
      enabled: true,
      exemptRoles: ['r'],
      exemptChannels: ['c'],
    });
  });
});

describe('listAutomodRules', () => {
  it('requests the rules route', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return [rawRule];
    });

    const result = await listAutomodRules({ guildId: 'g' }, createContext(discord));

    expect(captured?.r).toBe('/guilds/g/auto-moderation/rules');
    expect(textOf(result)).toContain('Keyword filter');
  });
});

describe('getAutomodRule', () => {
  it('requests the single rule route', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawRule;
    });

    await getAutomodRule({ guildId: 'g', ruleId: 'r1' }, createContext(discord));

    expect(captured?.r).toBe('/guilds/g/auto-moderation/rules/r1');
  });
});

describe('createAutomodRule', () => {
  it('posts the normalized rule body', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return rawRule;
    });

    await createAutomodRule(
      {
        guildId: 'g',
        name: 'n',
        eventType: 'messageSend',
        triggerType: 'keyword',
        keywordFilter: ['bad'],
        actions: [{ type: 'blockMessage', customMessage: 'no' }],
      },
      createContext(discord),
    );

    expect(captured?.m).toBe('POST');
    expect(captured?.r).toBe('/guilds/g/auto-moderation/rules');
    expect(captured?.o.body).toEqual({
      name: 'n',
      event_type: 1,
      trigger_type: 1,
      actions: [{ type: 1, metadata: { custom_message: 'no' } }],
      trigger_metadata: { keyword_filter: ['bad'] },
    });
  });
});

describe('deleteAutomodRule', () => {
  it('requires consent', async () => {
    const discord = new DiscordClient('token', async () => {
      throw new Error('should not run');
    });
    const result = await deleteAutomodRule({ guildId: 'g', ruleId: 'r1' }, createContext(discord));
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('consent');
  });

  it('deletes with consent', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return null;
    });

    const result = await deleteAutomodRule(
      { guildId: 'g', ruleId: 'r1', confirm: true },
      createContext(discord),
    );

    expect(captured?.m).toBe('DELETE');
    expect(captured?.r).toBe('/guilds/g/auto-moderation/rules/r1');
    expect(textOf(result)).toContain('Deleted automod rule r1');
  });
});

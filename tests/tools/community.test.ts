import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import {
  getMemberVerification,
  getOnboarding,
  getWelcomeScreen,
  modifyMemberVerification,
  modifyOnboarding,
  modifyWelcomeScreen,
  modifyWelcomeScreenInput,
  summarizeMemberVerification,
  summarizeOnboarding,
  summarizeWelcomeScreen,
} from '../../src/tools/community.js';
import { createContext, textOf, type RecordedRequest } from '../helpers.js';

describe('welcome screen', () => {
  it('summarizes a raw welcome screen', () => {
    expect(
      summarizeWelcomeScreen({
        description: 'hi',
        welcome_channels: [{ channel_id: 'c1', description: 'chat', emoji_id: null, emoji_name: '👋' }],
      }),
    ).toEqual({
      description: 'hi',
      welcomeChannels: [{ channelId: 'c1', description: 'chat', emojiId: null, emojiName: '👋' }],
    });
  });

  it('gets the welcome screen', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return { description: null, welcome_channels: [] };
    });
    await getWelcomeScreen({ guildId: 'g1' }, createContext(discord));
    expect(captured?.r).toBe('/guilds/g1/welcome-screen');
  });

  it('reports a clear message when no welcome screen is configured', async () => {
    const discord = new DiscordClient('token', async () => {
      throw new Error('Unknown Guild Welcome Screen');
    });

    const result = await getWelcomeScreen({ guildId: 'g1' }, createContext(discord));

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('no welcome screen configured');
  });

  it('requires a welcome channel when enabling the screen', () => {
    const result = modifyWelcomeScreenInput.safeParse({ guildId: 'g1', enabled: true });
    expect(result.success).toBe(false);
  });

  it('rejects a welcome channel with both an emoji id and name', () => {
    const result = modifyWelcomeScreenInput.safeParse({
      guildId: 'g1',
      welcomeChannels: [{ channelId: 'c1', description: 'chat', emojiId: '1', emojiName: '👋' }],
    });
    expect(result.success).toBe(false);
  });

  it('modifies the welcome screen body', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return { enabled: true };
    });
    await modifyWelcomeScreen(
      {
        guildId: 'g1',
        enabled: true,
        welcomeChannels: [{ channelId: 'c1', description: 'chat', emojiName: '👋' }],
      },
      createContext(discord),
    );
    expect(captured?.m).toBe('PATCH');
    expect(captured?.o.body).toEqual({
      enabled: true,
      welcome_channels: [
        { channel_id: 'c1', description: 'chat', emoji_id: undefined, emoji_name: '👋' },
      ],
    });
  });
});

describe('onboarding', () => {
  it('summarizes a raw onboarding', () => {
    expect(
      summarizeOnboarding({
        guild_id: 'g1',
        enabled: true,
        mode: 1,
        default_channel_ids: ['c1'],
        prompts: [
          {
            id: 'p1',
            type: 1,
            title: 'Pick',
            single_select: true,
            required: true,
            in_onboarding: true,
            options: [
              {
                id: 'o1',
                title: 'One',
                channel_ids: ['c1'],
                role_ids: ['r1'],
                emoji: { name: '🎮', id: null },
              },
            ],
          },
        ],
      }),
    ).toEqual({
      guildId: 'g1',
      enabled: true,
      mode: 'advanced',
      defaultChannels: ['c1'],
      prompts: [
        {
          id: 'p1',
          title: 'Pick',
          type: 'dropdown',
          singleSelect: true,
          required: true,
          inOnboarding: true,
          options: [
            {
              id: 'o1',
              title: 'One',
              description: undefined,
              channelIds: ['c1'],
              roleIds: ['r1'],
              emojiName: '🎮',
              emojiId: null,
            },
          ],
        },
      ],
    });
  });

  it('modifies the onboarding body', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return { guild_id: 'g1', prompts: [], default_channel_ids: [], enabled: true, mode: 1 };
    });
    await modifyOnboarding(
      {
        guildId: 'g1',
        mode: 'advanced',
        defaultChannels: ['c1'],
        prompts: [
          {
            id: 'p1',
            title: 'Pick',
            type: 'dropdown',
            options: [{ id: 'o1', title: 'One', roleIds: ['r1'] }],
          },
        ],
      },
      createContext(discord),
    );
    expect(captured?.m).toBe('PUT');
    expect(captured?.o.body).toEqual({
      mode: 1,
      default_channel_ids: ['c1'],
      prompts: [
        {
          id: 'p1',
          title: 'Pick',
          type: 1,
          single_select: undefined,
          required: undefined,
          in_onboarding: undefined,
          options: [
            {
              id: 'o1',
              title: 'One',
              description: undefined,
              channel_ids: undefined,
              role_ids: ['r1'],
              emoji: undefined,
            },
          ],
        },
      ],
    });
  });

  it('gets the onboarding', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return { guild_id: 'g1', prompts: [], default_channel_ids: [], enabled: false, mode: 0 };
    });
    await getOnboarding({ guildId: 'g1' }, createContext(discord));
    expect(captured?.r).toBe('/guilds/g1/onboarding');
  });
});

describe('member verification', () => {
  it('summarizes a raw member verification', () => {
    expect(
      summarizeMemberVerification({
        enabled: true,
        description: 'rules',
        form_fields: [{ field_type: 'MULTIPLE_CHOICE', label: 'Agree', required: true, values: ['Yes'] }],
      }),
    ).toEqual({
      enabled: true,
      description: 'rules',
      formFields: [{ fieldType: 'multipleChoice', label: 'Agree', required: true, values: ['Yes'] }],
    });
  });

  it('modifies the member verification body', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return { enabled: true, form_fields: [] };
    });
    await modifyMemberVerification(
      {
        guildId: 'g1',
        formFields: [{ fieldType: 'terms', label: 'Rules', required: true }],
      },
      createContext(discord),
    );
    expect(captured?.m).toBe('PATCH');
    expect(captured?.o.body).toEqual({
      form_fields: [{ field_type: 'TERMS', label: 'Rules', required: true, values: undefined }],
    });
  });

  it('gets the member verification', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return { enabled: false, form_fields: [] };
    });
    const result = await getMemberVerification({ guildId: 'g1' }, createContext(discord));
    expect(captured?.r).toBe('/guilds/g1/member-verification');
    expect(textOf(result)).toContain('"enabled": false');
  });
});

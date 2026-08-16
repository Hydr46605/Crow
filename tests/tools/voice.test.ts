import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import { modifyVoiceState } from '../../src/tools/voice.js';
import { createContext, type RecordedRequest } from '../helpers.js';

describe('modifyVoiceState', () => {
  it('patches the voice state route', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return null;
    });

    await modifyVoiceState({ guildId: 'g1', userId: 'u1', suppress: true }, createContext(discord));

    expect(captured?.m).toBe('PATCH');
    expect(captured?.r).toBe('/guilds/g1/voice-states/u1');
    expect(captured?.o.body).toEqual({ suppress: true });
  });

  it('maps requestToSpeak to a timestamp or null', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return null;
    });

    await modifyVoiceState({ guildId: 'g1', userId: '@me', requestToSpeak: true }, createContext(discord));
    expect(captured?.r).toBe('/guilds/g1/voice-states/@me');
    expect((captured?.o.body as { request_to_speak_timestamp: string }).request_to_speak_timestamp).toBeDefined();

    await modifyVoiceState({ guildId: 'g1', userId: '@me', requestToSpeak: false }, createContext(discord));
    expect((captured?.o.body as { request_to_speak_timestamp: null }).request_to_speak_timestamp).toBeNull();
  });
});

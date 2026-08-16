import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import {
  getVoiceState,
  modifyVoiceState,
  modifyVoiceStateInput,
  summarizeVoiceState,
} from '../../src/tools/voice.js';
import { createContext, type RecordedRequest } from '../helpers.js';

describe('summarizeVoiceState', () => {
  it('maps voice-state fields, defaulting booleans and nulls', () => {
    expect(
      summarizeVoiceState({
        channel_id: 'c1',
        session_id: 's1',
        self_mute: true,
        suppress: false,
        request_to_speak_timestamp: '2026-09-18T10:00:00.000Z',
      }),
    ).toEqual({
      channelId: 'c1',
      sessionId: 's1',
      deaf: false,
      mute: false,
      selfDeaf: false,
      selfMute: true,
      selfStream: false,
      selfVideo: false,
      suppress: false,
      requestToSpeakTimestamp: '2026-09-18T10:00:00.000Z',
    });
  });
});

describe('getVoiceState', () => {
  it('requests the voice-state route', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return { channel_id: 'c1' };
    });

    await getVoiceState({ guildId: 'g1', userId: '@me' }, createContext(discord));

    expect(captured?.m).toBe('GET');
    expect(captured?.r).toBe('/guilds/g1/voice-states/@me');
  });
});

describe('modifyVoiceStateInput', () => {
  it('requires at least one modifier field', () => {
    expect(modifyVoiceStateInput.safeParse({ guildId: '123456789012345678', userId: '@me' }).success).toBe(false);
    expect(
      modifyVoiceStateInput.safeParse({ guildId: '123456789012345678', userId: '@me', suppress: true }).success,
    ).toBe(true);
  });

  it('rejects requestToSpeak for a non-@me user', () => {
    expect(
      modifyVoiceStateInput.safeParse({
        guildId: '123456789012345678',
        userId: '123456789012345678',
        requestToSpeak: true,
      }).success,
    ).toBe(false);
    expect(
      modifyVoiceStateInput.safeParse({ guildId: '123456789012345678', userId: '@me', requestToSpeak: true })
        .success,
    ).toBe(true);
  });
});

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

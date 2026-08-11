import { describe, expect, it } from 'vitest';
import {
  GATEWAY_GUILD_MEMBERS,
  GATEWAY_MESSAGE_CONTENT,
} from '../../src/cli/checker.js';
import { runDoctor, summarizeDoctor } from '../../src/cli/doctor.js';
import { DiscordClient, DiscordRequestError } from '../../src/discord/client.js';

const identity = { id: '123456789012345678', username: 'crowbot', bot: true };

describe('runDoctor', () => {
  it('returns identity and enabled intents for a healthy token', async () => {
    const discord = new DiscordClient('token', async (_method, route) => {
      if (route === '/users/@me') return identity;
      return { id: 'app', name: 'Crow', flags: GATEWAY_GUILD_MEMBERS | GATEWAY_MESSAGE_CONTENT };
    });

    const result = await runDoctor(discord);

    expect(result.tokenValid).toBe(true);
    expect(result.identity).toEqual(identity);
    expect(result.intents).toEqual({ guildMembers: 'enabled', messageContent: 'enabled' });
  });

  it('flags a 401 response as an invalid token', async () => {
    const discord = new DiscordClient('token', async () => {
      throw new DiscordRequestError('401: Unauthorized', 401);
    });

    const result = await runDoctor(discord);

    expect(result.tokenValid).toBe(false);
    expect(result.identity).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it('surfaces non-401 failures as an error with the token invalid', async () => {
    const discord = new DiscordClient('token', async () => {
      throw new DiscordRequestError('network down', 503);
    });

    const result = await runDoctor(discord);

    expect(result.tokenValid).toBe(false);
    expect(result.error).toContain('network down');
  });

  it('keeps the token valid when intents cannot be read', async () => {
    const discord = new DiscordClient('token', async (_method, route) => {
      if (route === '/users/@me') return identity;
      throw new DiscordRequestError('forbidden', 403);
    });

    const result = await runDoctor(discord);

    expect(result.tokenValid).toBe(true);
    expect(result.intents).toBeUndefined();
    expect(result.error).toContain('reading application intents failed');
  });
});

describe('summarizeDoctor', () => {
  it('is healthy when token and intents are fine', () => {
    const result = {
      tokenValid: true,
      identity,
      intents: { guildMembers: 'enabled' as const, messageContent: 'enabled' as const },
    };
    const summary = summarizeDoctor(result);

    expect(summary.healthy).toBe(true);
    expect(summary.problems).toHaveLength(0);
  });

  it('lists a disabled intent as a problem', () => {
    const result = {
      tokenValid: true,
      identity,
      intents: { guildMembers: 'disabled' as const, messageContent: 'enabled' as const },
    };
    const summary = summarizeDoctor(result);

    expect(summary.healthy).toBe(false);
    expect(summary.problems.some((p) => p.includes('GUILD_MEMBERS'))).toBe(true);
  });

  it('flags an invalid token', () => {
    const summary = summarizeDoctor({ tokenValid: false });

    expect(summary.healthy).toBe(false);
    expect(summary.problems).toHaveLength(1);
  });
});

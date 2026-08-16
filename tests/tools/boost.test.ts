import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import { getBoostInfo, summarizeBoostInfo } from '../../src/tools/boost.js';
import { createContext, type RecordedRequest } from '../helpers.js';

describe('summarizeBoostInfo', () => {
  it('maps premium tier, count, and progress bar', () => {
    expect(
      summarizeBoostInfo({
        premium_tier: 2,
        premium_subscription_count: 9,
        premium_progress_bar_enabled: true,
      }),
    ).toEqual({ premiumTier: 2, level: 'level2', boostCount: 9, progressBarEnabled: true });
  });

  it('defaults to tier none when absent', () => {
    expect(summarizeBoostInfo({}).level).toBe('none');
  });
});

describe('getBoostInfo', () => {
  it('requests the guild route', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (m, r, o) => {
      captured = { m, r, o };
      return { premium_tier: 1, premium_subscription_count: 3 };
    });

    await getBoostInfo({ guildId: 'g1' }, createContext(discord));

    expect(captured?.r).toBe('/guilds/g1');
  });
});

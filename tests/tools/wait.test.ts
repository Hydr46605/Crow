import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import { waitForMessage } from '../../src/tools/wait.js';
import { createContext, textOf } from '../helpers.js';

const rawMessage = (id: string, authorId = 'u1') => ({
  id,
  channel_id: 'c1',
  author: { id: authorId, username: 'alice' },
  content: `msg ${id}`,
  timestamp: '2026-08-18T00:00:00.000Z',
});

describe('waitForMessage', () => {
  it('returns new messages after the cursor', async () => {
    const discord = new DiscordClient('token', async (m, r, o) => {
      expect(o.query?.after).toBe('seed');
      return [rawMessage('m2'), rawMessage('m1')];
    });

    const result = await waitForMessage({ channelId: 'c1', after: 'seed' }, createContext(discord));
    const text = textOf(result);

    expect(text).toContain('msg m2');
    expect(text).toContain('msg m1');
  });

  it('filters to a single user', async () => {
    const discord = new DiscordClient('token', async () => [rawMessage('m2', 'u1'), rawMessage('m1', 'u2')]);

    const result = await waitForMessage(
      { channelId: 'c1', after: 'seed', userId: 'u1' },
      createContext(discord),
    );
    const text = textOf(result);

    expect(text).toContain('msg m2');
    expect(text).not.toContain('msg m1');
  });

  it('seeds the cursor from the latest message when none is given', async () => {
    const afters: (string | undefined | null)[] = [];
    const discord = new DiscordClient('token', async (m, r, o) => {
      afters.push(o.query?.after ?? null);
      return afters.length === 1 ? [rawMessage('latest')] : [rawMessage('m2')];
    });

    const result = await waitForMessage({ channelId: 'c1' }, createContext(discord));

    expect(textOf(result)).toContain('msg m2');
    expect(afters).toEqual([null, 'latest']);
  });

  it('times out and reports when nothing arrives', async () => {
    const discord = new DiscordClient('token', async () => []);

    const result = await waitForMessage(
      { channelId: 'c1', after: 'seed', timeoutSeconds: 0 } as never,
      createContext(discord),
    );

    expect(textOf(result)).toContain('Timed out');
  });
});

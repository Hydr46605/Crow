import { describe, expect, it } from 'vitest';
import { DiscordClient, DiscordRequestError } from '../../src/discord/client.js';
import type { RecordedRequest } from '../helpers.js';

describe('DiscordClient.request', () => {
  it('returns the parsed response body', async () => {
    const discord = new DiscordClient('token', async () => ({ id: '1' }));
    await expect(discord.request('GET', '/channels/1/messages')).resolves.toEqual({ id: '1' });
  });

  it('passes request options through to the executor', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (method, route, options) => {
      captured = { method, route, options };
      return null;
    });

    await discord.request('POST', '/channels/1/messages', {
      body: { content: 'hi' },
      query: { limit: 5 },
      reason: 'test',
    });

    expect(captured).toEqual({
      method: 'POST',
      route: '/channels/1/messages',
      options: { body: { content: 'hi' }, query: { limit: 5 }, reason: 'test' },
    });
  });

  it('throws DiscordRequestError for a route missing the leading slash', async () => {
    const discord = new DiscordClient('token', async () => null);
    await expect(discord.request('GET', 'channels/1/messages')).rejects.toThrow(
      DiscordRequestError,
    );
  });

  it('redacts the token from request errors', async () => {
    const discord = new DiscordClient('super-secret-token', async () => {
      throw new Error('request failed with token super-secret-token');
    });

    try {
      await discord.request('GET', '/channels/1/messages');
      throw new Error('expected request to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(DiscordRequestError);
      expect((error as Error).message).toContain('[REDACTED]');
      expect((error as Error).message).not.toContain('super-secret-token');
    }
  });
});

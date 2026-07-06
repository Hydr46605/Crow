import { describe, expect, it } from 'vitest';
import { DiscordClient } from '../../src/discord/client.js';
import { rawRequest } from '../../src/tools/raw.js';
import { createContext, textOf, type RecordedRequest } from '../helpers.js';

describe('rawRequest', () => {
  it('passes method, route, body, query, and reason through and returns JSON', async () => {
    let captured: RecordedRequest | undefined;
    const discord = new DiscordClient('token', async (method, route, options) => {
      captured = { method, route, options };
      return { ok: true };
    });

    const result = await rawRequest(
      {
        method: 'POST',
        route: '/guilds/1/channels',
        body: { name: 'x' },
        query: { reason: 't' },
        reason: 'audit',
      },
      createContext(discord),
    );

    expect(captured).toEqual({
      method: 'POST',
      route: '/guilds/1/channels',
      options: { body: { name: 'x' }, query: { reason: 't' }, reason: 'audit' },
    });
    expect(textOf(result)).toContain('"ok": true');
  });

  it('returns an error result when the request fails', async () => {
    const discord = new DiscordClient('token', async () => {
      throw new Error('boom');
    });

    const result = await rawRequest({ method: 'GET', route: '/users/@me' }, createContext(discord));

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe('boom');
  });
});

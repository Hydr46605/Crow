import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ActionRuntime } from '../../src/actions/runtime.js';
import { DiscordClient } from '../../src/discord/client.js';
import { dispatchInteraction } from '../../src/gateway/transport.js';

const makeRuntime = (): { runtime: ActionRuntime; dir: string } => {
  const dir = mkdtempSync(join(tmpdir(), 'crow-transport-'));
  return { runtime: new ActionRuntime(join(dir, 'actions.json')), dir };
};

describe('dispatchInteraction', () => {
  it('dispatches a matching reply and returns true', async () => {
    const { runtime, dir } = makeRuntime();
    try {
      runtime.register({ kind: 'reply', customId: 'hello', content: 'hi' });

      let captured: { id: string; token: string; callback: unknown } | undefined;
      const discord = new DiscordClient(
        'token',
        async () => null,
        undefined,
        async (id, token, callback) => {
          captured = { id, token, callback };
          return null;
        },
      );

      const result = await dispatchInteraction(runtime, discord, {
        id: '111',
        type: 3,
        token: 'itok',
        data: { custom_id: 'hello' },
      });

      expect(result).toBe(true);
      expect(captured).toEqual({
        id: '111',
        token: 'itok',
        callback: { type: 4, data: { content: 'hi' } },
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns false without calling back for an unmatched custom_id', async () => {
    const { runtime, dir } = makeRuntime();
    try {
      let called = false;
      const discord = new DiscordClient('token', async () => null, undefined, async () => {
        called = true;
        return null;
      });

      const result = await dispatchInteraction(runtime, discord, {
        id: '111',
        type: 3,
        token: 'itok',
        data: { custom_id: 'nope' },
      });

      expect(result).toBe(false);
      expect(called).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ActionRuntime } from '../../src/actions/runtime.js';
import { DiscordClient } from '../../src/discord/client.js';
import { listActions, registerAction, removeAction } from '../../src/tools/actions.js';
import { createContext, textOf } from '../helpers.js';

const makeContext = () => {
  const dir = mkdtempSync(join(tmpdir(), 'crow-actions-tools-'));
  const runtime = new ActionRuntime(join(dir, 'actions.json'));
  const discord = new DiscordClient('token');
  return { ctx: createContext(discord, runtime), runtime, dir };
};

describe('registerAction', () => {
  it('registers an action and returns it', async () => {
    const { ctx, runtime, dir } = makeContext();
    try {
      const result = await registerAction({ customId: 'x', content: 'hi' }, ctx);
      expect(runtime.list()).toEqual([{ customId: 'x', content: 'hi' }]);
      expect(textOf(result)).toContain('"customId": "x"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('listActions', () => {
  it('lists registered actions', async () => {
    const { ctx, runtime, dir } = makeContext();
    try {
      runtime.register({ customId: 'x', content: 'hi' });
      const result = await listActions(ctx);
      expect(textOf(result)).toContain('"customId": "x"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('removeAction', () => {
  it('removes a registered action', async () => {
    const { ctx, runtime, dir } = makeContext();
    try {
      runtime.register({ customId: 'x', content: 'hi' });
      const result = await removeAction({ customId: 'x' }, ctx);
      expect(runtime.list()).toEqual([]);
      expect(textOf(result)).toContain('Removed action "x"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports when nothing is registered', async () => {
    const { ctx, dir } = makeContext();
    try {
      const result = await removeAction({ customId: 'missing' }, ctx);
      expect(textOf(result)).toContain('No action registered');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

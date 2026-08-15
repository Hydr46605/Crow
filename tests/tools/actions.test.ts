import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ActionRuntime } from '../../src/actions/runtime.js';
import type { Action } from '../../src/actions/types.js';
import { DiscordClient } from '../../src/discord/client.js';
import { listActions, listRecentInteractions, registerAction, removeAction } from '../../src/tools/actions.js';
import { createContext, textOf } from '../helpers.js';

const makeContext = () => {
  const dir = mkdtempSync(join(tmpdir(), 'crow-actions-tools-'));
  const runtime = new ActionRuntime(join(dir, 'actions.json'), join(dir, 'interactions.json'));
  const discord = new DiscordClient('token');
  return { ctx: createContext(discord, runtime), runtime, dir };
};

const replyAction: Action = { kind: 'reply', customId: 'x', content: 'hi' };

describe('registerAction', () => {
  it('registers a reply action and returns it', async () => {
    const { ctx, runtime, dir } = makeContext();
    try {
      const result = await registerAction(replyAction, ctx);
      expect(runtime.list()).toEqual([replyAction]);
      expect(textOf(result)).toContain('"kind": "reply"');
      expect(textOf(result)).toContain('"customId": "x"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('registers a modal action and returns it', async () => {
    const { ctx, runtime, dir } = makeContext();
    try {
      const modal: Action = {
        kind: 'modal',
        customId: 'open',
        title: 'Form',
        inputs: [{ customId: 'a', label: 'A', style: 'short' }],
        submitCustomId: 'submit',
        content: 'done',
      };
      const result = await registerAction(modal, ctx);
      expect(runtime.list()).toEqual([modal]);
      expect(textOf(result)).toContain('"kind": "modal"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('listActions', () => {
  it('lists registered actions', async () => {
    const { ctx, runtime, dir } = makeContext();
    try {
      runtime.register(replyAction);
      const result = await listActions(ctx);
      expect(textOf(result)).toContain('"customId": "x"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('listRecentInteractions', () => {
  it('lists recorded interactions', async () => {
    const { ctx, runtime, dir } = makeContext();
    try {
      runtime.recordInteraction({
        id: 'i1',
        customId: 'x',
        type: 3,
        values: ['v'],
        inputs: {},
        timestamp: 't',
      });
      const result = await listRecentInteractions({ limit: 10 }, ctx);
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
      runtime.register(replyAction);
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

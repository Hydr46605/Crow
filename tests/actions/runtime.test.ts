import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ActionRuntime, EPHEMERAL_FLAG, resolveInteraction } from '../../src/actions/runtime.js';
import type { Action } from '../../src/actions/types.js';

const action: Action = { customId: 'hello', content: 'hi there', ephemeral: true };

describe('resolveInteraction', () => {
  const map = new Map([[action.customId, action]]);

  it('matches a registered custom_id', () => {
    const result = resolveInteraction(map, { data: { custom_id: 'hello' } });
    expect(result).toEqual({
      matched: true,
      customId: 'hello',
      reply: { type: 4, data: { content: 'hi there', flags: EPHEMERAL_FLAG } },
    });
  });

  it('normalizes embeds and omits flags when not ephemeral', () => {
    const withEmbed: Action = { customId: 'e', embeds: [{ title: 'T', color: '#ff0000' }] };
    const result = resolveInteraction(new Map([['e', withEmbed]]), { data: { custom_id: 'e' } });
    expect(result.reply?.data.embeds).toEqual([{ title: 'T', color: 16711680 }]);
    expect(result.reply?.data.flags).toBeUndefined();
  });

  it('returns unmatched for an unknown custom_id', () => {
    expect(resolveInteraction(map, { data: { custom_id: 'nope' } })).toEqual({
      matched: false,
      customId: 'nope',
    });
  });

  it('returns unmatched when there is no custom_id', () => {
    expect(resolveInteraction(map, {})).toEqual({ matched: false });
  });
});

describe('ActionRuntime', () => {
  const makeRuntime = (): { runtime: ActionRuntime; dir: string } => {
    const dir = mkdtempSync(join(tmpdir(), 'crow-actions-'));
    return { runtime: new ActionRuntime(join(dir, 'actions.json')), dir };
  };

  it('registers, lists, and removes actions', () => {
    const { runtime, dir } = makeRuntime();
    try {
      runtime.register(action);
      expect(runtime.list()).toEqual([action]);
      expect(runtime.remove('hello')).toBe(true);
      expect(runtime.list()).toEqual([]);
      expect(runtime.remove('hello')).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('persists and reloads from disk', () => {
    const { runtime, dir } = makeRuntime();
    try {
      runtime.register(action);
      const reloaded = new ActionRuntime(join(dir, 'actions.json'));
      reloaded.load();
      expect(reloaded.list()).toEqual([action]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loads empty when the file is missing or corrupt', () => {
    const { runtime, dir } = makeRuntime();
    try {
      runtime.load();
      expect(runtime.list()).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('resolves via the runtime map', () => {
    const { runtime, dir } = makeRuntime();
    try {
      runtime.register(action);
      expect(runtime.resolve({ data: { custom_id: 'hello' } }).matched).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

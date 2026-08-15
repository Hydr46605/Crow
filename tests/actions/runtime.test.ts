import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ActionRuntime,
  CALLBACK_CHANNEL_MESSAGE,
  CALLBACK_MODAL,
  EPHEMERAL_FLAG,
  INTERACTION_COMPONENT,
  INTERACTION_MODAL_SUBMIT,
  resolveInteraction,
} from '../../src/actions/runtime.js';
import type { Action } from '../../src/actions/types.js';

const replyAction: Action = { kind: 'reply', customId: 'hello', content: 'hi there', ephemeral: true };

const modalAction: Action = {
  kind: 'modal',
  customId: 'open-form',
  title: 'Feedback',
  inputs: [
    { customId: 'name', label: 'Name', style: 'short', required: true },
    { customId: 'note', label: 'Notes', style: 'paragraph', maxLength: 200 },
  ],
  submitCustomId: 'feedback-submit',
  content: 'Thanks!',
  ephemeral: true,
};

describe('resolveInteraction', () => {
  const map = new Map([
    [replyAction.customId, replyAction],
    [modalAction.customId, modalAction],
  ]);

  it('matches a registered reply custom_id on a component interaction', () => {
    const result = resolveInteraction(map, {
      type: INTERACTION_COMPONENT,
      data: { custom_id: 'hello' },
    });
    expect(result).toEqual({
      matched: true,
      customId: 'hello',
      callback: { type: CALLBACK_CHANNEL_MESSAGE, data: { content: 'hi there', flags: EPHEMERAL_FLAG } },
    });
  });

  it('treats a missing interaction type as a component interaction', () => {
    const result = resolveInteraction(map, { data: { custom_id: 'hello' } });
    expect(result.matched).toBe(true);
    expect(result.callback).toEqual({ type: 4, data: { content: 'hi there', flags: 64 } });
  });

  it('normalizes embeds and omits flags when not ephemeral', () => {
    const withEmbed: Action = { kind: 'reply', customId: 'e', embeds: [{ title: 'T', color: '#ff0000' }] };
    const result = resolveInteraction(new Map([['e', withEmbed]]), {
      type: INTERACTION_COMPONENT,
      data: { custom_id: 'e' },
    });
    expect(result.callback?.data.embeds).toEqual([{ title: 'T', color: 16711680 }]);
    expect(result.callback?.data.flags).toBeUndefined();
  });

  it('opens a modal for a modal action on component click', () => {
    const result = resolveInteraction(map, {
      type: INTERACTION_COMPONENT,
      data: { custom_id: 'open-form' },
    });
    expect(result).toEqual({
      matched: true,
      customId: 'open-form',
      callback: {
        type: CALLBACK_MODAL,
        data: {
          custom_id: 'feedback-submit',
          title: 'Feedback',
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: 'name',
                  label: 'Name',
                  style: 1,
                  required: true,
                  placeholder: undefined,
                  min_length: undefined,
                  max_length: undefined,
                },
                {
                  type: 4,
                  custom_id: 'note',
                  label: 'Notes',
                  style: 2,
                  required: undefined,
                  placeholder: undefined,
                  min_length: undefined,
                  max_length: 200,
                },
              ],
            },
          ],
        },
      },
    });
  });

  it('replies when a modal is submitted', () => {
    const result = resolveInteraction(map, {
      type: INTERACTION_MODAL_SUBMIT,
      data: { custom_id: 'feedback-submit' },
    });
    expect(result).toEqual({
      matched: true,
      customId: 'feedback-submit',
      callback: { type: CALLBACK_CHANNEL_MESSAGE, data: { content: 'Thanks!', flags: EPHEMERAL_FLAG } },
    });
  });

  it('returns unmatched for an unknown custom_id', () => {
    expect(resolveInteraction(map, { type: INTERACTION_COMPONENT, data: { custom_id: 'nope' } })).toEqual({
      matched: false,
      customId: 'nope',
    });
  });

  it('returns unmatched when there is no custom_id', () => {
    expect(resolveInteraction(map, {})).toEqual({ matched: false });
  });

  it('substitutes selected values into the reply', () => {
    const withValues: Action = { kind: 'reply', customId: 'pick', content: 'You chose {values}' };
    const result = resolveInteraction(new Map([['pick', withValues]]), {
      type: INTERACTION_COMPONENT,
      data: { custom_id: 'pick', values: ['red', 'blue'] },
    });
    expect(result.callback).toEqual({ type: 4, data: { content: 'You chose red, blue' } });
  });

  it('substitutes modal input values into the submit reply', () => {
    const form: Action = {
      kind: 'modal',
      customId: 'open',
      title: 'Form',
      inputs: [{ customId: 'name', label: 'Name', style: 'short' }],
      submitCustomId: 'submit',
      content: 'Thanks {input.name}!',
    };
    const result = resolveInteraction(new Map([['open', form]]), {
      type: INTERACTION_MODAL_SUBMIT,
      data: {
        custom_id: 'submit',
        components: [{ components: [{ custom_id: 'name', value: 'Alice' }] }],
      },
    });
    expect(result.callback).toEqual({ type: 4, data: { content: 'Thanks Alice!' } });
  });
});

describe('ActionRuntime', () => {
  const makeRuntime = (): { runtime: ActionRuntime; dir: string } => {
    const dir = mkdtempSync(join(tmpdir(), 'crow-actions-'));
    return {
      runtime: new ActionRuntime(join(dir, 'actions.json'), join(dir, 'interactions.json')),
      dir,
    };
  };

  it('registers, lists, and removes actions', () => {
    const { runtime, dir } = makeRuntime();
    try {
      runtime.register(replyAction);
      expect(runtime.list()).toEqual([replyAction]);
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
      runtime.register(replyAction);
      const reloaded = new ActionRuntime(join(dir, 'actions.json'));
      reloaded.load();
      expect(reloaded.list()).toEqual([replyAction]);
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
      runtime.register(replyAction);
      expect(runtime.resolve({ type: INTERACTION_COMPONENT, data: { custom_id: 'hello' } }).matched).toBe(
        true,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('records and lists recent interactions', () => {
    const { runtime, dir } = makeRuntime();
    try {
      runtime.recordInteraction({
        id: 'i1',
        customId: 'c',
        type: 3,
        values: ['v'],
        inputs: { a: 'b' },
        timestamp: 't',
      });
      expect(runtime.listInteractions()).toEqual([
        { id: 'i1', customId: 'c', type: 3, values: ['v'], inputs: { a: 'b' }, timestamp: 't' },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

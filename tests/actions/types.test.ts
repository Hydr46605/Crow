import { describe, expect, it } from 'vitest';
import { actionSchema } from '../../src/actions/types.js';

describe('actionSchema', () => {
  it('defaults legacy entries without a kind to reply', () => {
    expect(actionSchema.parse({ customId: 'x', content: 'hi' })).toEqual({
      kind: 'reply',
      customId: 'x',
      content: 'hi',
    });
  });

  it('accepts an explicit reply action', () => {
    const action = { kind: 'reply', customId: 'x', embeds: [{ title: 'T' }] };
    expect(actionSchema.parse(action)).toEqual(action);
  });

  it('accepts a valid modal action', () => {
    const action = {
      kind: 'modal',
      customId: 'open',
      title: 'Form',
      inputs: [{ customId: 'a', label: 'A', style: 'short' }],
      submitCustomId: 'submit',
      content: 'done',
    };
    expect(actionSchema.parse(action)).toEqual(action);
  });

  it('rejects a reply action with neither content nor embeds', () => {
    expect(actionSchema.safeParse({ kind: 'reply', customId: 'x' }).success).toBe(false);
  });

  it('rejects a modal action with neither content nor embeds', () => {
    const action = {
      kind: 'modal',
      customId: 'open',
      title: 'Form',
      inputs: [{ customId: 'a', label: 'A', style: 'short' }],
      submitCustomId: 'submit',
    };
    expect(actionSchema.safeParse(action).success).toBe(false);
  });

  it('rejects a modal action without inputs', () => {
    const action = {
      kind: 'modal',
      customId: 'open',
      title: 'Form',
      inputs: [],
      submitCustomId: 'submit',
      content: 'done',
    };
    expect(actionSchema.safeParse(action).success).toBe(false);
  });
});

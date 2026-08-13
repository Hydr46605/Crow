import { describe, expect, it } from 'vitest';
import {
  interactiveComponentSchema,
  normalizeComponents,
  normalizeTextInputs,
  textInputSchema,
} from '../../src/tools/components.js';

describe('normalizeComponents', () => {
  it('normalizes buttons and action rows to Discord numeric JSON', () => {
    const input = [
      {
        type: 'actionRow' as const,
        components: [
          { type: 'button' as const, style: 'primary' as const, label: 'Click', customId: 'x' },
          { type: 'button' as const, style: 'link' as const, label: 'Site', url: 'https://example.com' },
        ],
      },
    ];

    expect(normalizeComponents(input)).toEqual([
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: 'Click',
            custom_id: 'x',
            url: undefined,
            emoji: undefined,
            disabled: undefined,
          },
          {
            type: 2,
            style: 5,
            label: 'Site',
            custom_id: undefined,
            url: 'https://example.com',
            emoji: undefined,
            disabled: undefined,
          },
        ],
      },
    ]);
  });

  it('normalizes a string select menu', () => {
    const input = [
      {
        type: 'actionRow' as const,
        components: [
          {
            type: 'stringSelect' as const,
            customId: 'menu',
            minValues: 1,
            maxValues: 1,
            options: [{ label: 'A', value: 'a' }],
          },
        ],
      },
    ];

    expect(normalizeComponents(input)).toEqual([
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: 'menu',
            placeholder: undefined,
            min_values: 1,
            max_values: 1,
            disabled: undefined,
            options: [{ label: 'A', value: 'a', description: undefined, emoji: undefined, default: undefined }],
          },
        ],
      },
    ]);
  });

  it('maps channel select types to numeric codes', () => {
    const input = [
      {
        type: 'actionRow' as const,
        components: [
          { type: 'channelSelect' as const, customId: 'ch', channelTypes: ['text' as const, 'voice' as const] },
        ],
      },
    ];

    expect(normalizeComponents(input)).toEqual([
      {
        type: 1,
        components: [
          {
            type: 8,
            custom_id: 'ch',
            placeholder: undefined,
            min_values: undefined,
            max_values: undefined,
            disabled: undefined,
            channel_types: [0, 2],
          },
        ],
      },
    ]);
  });
});

describe('interactiveComponentSchema', () => {
  it('rejects a link button without a url', () => {
    const result = interactiveComponentSchema.safeParse({ type: 'button', style: 'link', label: 'x' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-link button without a customId', () => {
    const result = interactiveComponentSchema.safeParse({ type: 'button', style: 'primary', label: 'x' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid primary button', () => {
    const result = interactiveComponentSchema.safeParse({ type: 'button', style: 'primary', customId: 'x' });
    expect(result.success).toBe(true);
  });
});

describe('textInputSchema', () => {
  it('rejects an input whose minLength exceeds maxLength', () => {
    const result = textInputSchema.safeParse({
      customId: 'x',
      label: 'X',
      style: 'short',
      minLength: 10,
      maxLength: 5,
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid short input', () => {
    const result = textInputSchema.safeParse({ customId: 'x', label: 'X', style: 'short', required: true });
    expect(result.success).toBe(true);
  });
});

describe('normalizeTextInputs', () => {
  it('maps friendly inputs to Discord numeric text-input JSON', () => {
    expect(
      normalizeTextInputs([
        { customId: 'a', label: 'A', style: 'short', required: true },
        { customId: 'b', label: 'B', style: 'paragraph', maxLength: 200 },
      ]),
    ).toEqual([
      {
        type: 4,
        custom_id: 'a',
        label: 'A',
        style: 1,
        required: true,
        placeholder: undefined,
        min_length: undefined,
        max_length: undefined,
      },
      {
        type: 4,
        custom_id: 'b',
        label: 'B',
        style: 2,
        required: undefined,
        placeholder: undefined,
        min_length: undefined,
        max_length: 200,
      },
    ]);
  });
});

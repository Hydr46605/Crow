import { describe, expect, it } from 'vitest';
import {
  interactiveComponentSchema,
  normalizeComponents,
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

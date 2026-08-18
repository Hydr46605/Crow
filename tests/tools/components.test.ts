import { describe, expect, it } from 'vitest';
import {
  componentsSchema,
  COMPONENTS_V2_FLAG,
  interactiveComponentSchema,
  isComponentsV2,
  normalizeComponents,
  normalizeTextInputs,
  referencedAttachmentNames,
  summarizeComponents,
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

describe('normalizeComponents (V2)', () => {
  it('normalizes a container with text display and a button action row', () => {
    const input = [
      {
        type: 'container' as const,
        accentColor: '#ff0000',
        spoiler: false,
        components: [
          { type: 'textDisplay' as const, content: 'Hello **world**' },
          { type: 'separator' as const, spacing: 'large' as const, divider: true },
          {
            type: 'actionRow' as const,
            components: [
              { type: 'button' as const, style: 'primary' as const, label: 'Go', customId: 'go' },
            ],
          },
        ],
      },
    ];

    expect(normalizeComponents(input)).toEqual([
      {
        type: 17,
        accent_color: 0xff0000,
        spoiler: false,
        components: [
          { type: 10, content: 'Hello **world**' },
          { type: 14, spacing: 2, divider: true },
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 1,
                label: 'Go',
                custom_id: 'go',
                url: undefined,
                emoji: undefined,
                disabled: undefined,
              },
            ],
          },
        ],
      },
    ]);
  });

  it('normalizes a section with a thumbnail accessory', () => {
    const input = [
      {
        type: 'section' as const,
        components: [{ type: 'textDisplay' as const, content: 'Stats' }],
        accessory: { type: 'thumbnail' as const, media: { url: 'https://example.com/i.png' } },
      },
    ];

    expect(normalizeComponents(input)).toEqual([
      {
        type: 9,
        components: [{ type: 10, content: 'Stats' }],
        accessory: { type: 11, media: { url: 'https://example.com/i.png' }, description: undefined },
      },
    ]);
  });

  it('normalizes a media gallery and file component', () => {
    const input = [
      {
        type: 'mediaGallery' as const,
        items: [{ media: { url: 'https://example.com/a.png' }, description: 'alt' }],
      },
      { type: 'file' as const, file: { url: 'attachment://f.txt' }, spoiler: true },
    ];

    expect(normalizeComponents(input)).toEqual([
      {
        type: 12,
        items: [{ media: { url: 'https://example.com/a.png' }, description: 'alt', spoiler: undefined }],
      },
      { type: 13, file: { url: 'attachment://f.txt' }, spoiler: true },
    ]);
  });
});

describe('isComponentsV2', () => {
  it('detects V2 layout components', () => {
    expect(isComponentsV2([{ type: 'textDisplay', content: 'x' }])).toBe(true);
    expect(isComponentsV2([{ type: 'actionRow', components: [] }])).toBe(false);
  });

  it('exposes the Components V2 flag bit', () => {
    expect(COMPONENTS_V2_FLAG).toBe(1 << 15);
  });
});

describe('componentsSchema', () => {
  it('rejects more than five action rows in V1 mode', () => {
    const rows = Array.from({ length: 6 }, () => ({
      type: 'actionRow' as const,
      components: [
        { type: 'button' as const, style: 'primary' as const, customId: 'x', label: 'x' },
      ],
    }));
    expect(componentsSchema.safeParse(rows).success).toBe(false);
  });

  it('accepts a container with layout children', () => {
    const result = componentsSchema.safeParse([
      {
        type: 'container',
        components: [{ type: 'textDisplay', content: 'hi' }],
      },
    ]);
    expect(result.success).toBe(true);
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

describe('summarizeComponents', () => {
  it('decodes numeric components to friendly shapes', () => {
    const result = summarizeComponents([
      { type: 1, components: [{ type: 2, style: 1, label: 'Go', custom_id: 'b' }] },
      { type: 17, accent_color: 255, components: [{ type: 10, content: 'hi' }] },
    ]);

    expect(result).toEqual([
      {
        type: 'actionRow',
        components: [
          { type: 'button', style: 'primary', label: 'Go', customId: 'b', url: null, emoji: undefined, disabled: false },
        ],
      },
      { type: 'container', accentColor: 255, spoiler: false, components: [{ type: 'textDisplay', content: 'hi' }] },
    ]);
  });

  it('decodes a separator with an omitted spacing as null', () => {
    expect(summarizeComponents([{ type: 14, divider: true }])).toEqual([
      { type: 'separator', spacing: null, divider: true },
    ]);
  });
});

describe('referencedAttachmentNames', () => {
  it('collects attachment:// filenames across the component tree', () => {
    const names = referencedAttachmentNames([
      { type: 'file', file: { url: 'attachment://a.pdf' } },
      {
        type: 'section',
        components: [{ type: 'textDisplay', content: 'x' }],
        accessory: { type: 'thumbnail', media: { url: 'attachment://b.png' } },
      },
      { type: 'mediaGallery', items: [{ media: { url: 'attachment://c.png' } }] },
    ]);

    expect(names).toEqual(['a.pdf', 'b.png', 'c.png']);
  });

  it('ignores external URLs', () => {
    expect(
      referencedAttachmentNames([{ type: 'mediaGallery', items: [{ media: { url: 'https://example.com/x.png' } }] }]),
    ).toEqual([]);
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

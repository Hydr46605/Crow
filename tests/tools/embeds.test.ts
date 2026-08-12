import { describe, expect, it } from 'vitest';
import { embedSchema, normalizeColor, normalizeEmbed } from '../../src/tools/embeds.js';

describe('normalizeColor', () => {
  it('passes integers through', () => {
    expect(normalizeColor(0x1abc9c)).toBe(0x1abc9c);
  });

  it('parses hex strings with a hash', () => {
    expect(normalizeColor('#1ABC9C')).toBe(0x1abc9c);
  });

  it('parses hex strings without a hash', () => {
    expect(normalizeColor('1abc9c')).toBe(0x1abc9c);
  });
});

describe('normalizeEmbed', () => {
  it('maps friendly fields to Discord snake_case JSON', () => {
    const embed = {
      title: 'T',
      description: 'D',
      url: 'https://example.com',
      color: '#ff0000',
      timestamp: '2026-08-16T00:00:00.000Z',
      author: { name: 'A', url: 'https://a.example', iconUrl: 'https://i.example' },
      footer: { text: 'F', iconUrl: 'https://f.example' },
      image: { url: 'https://img.example' },
      thumbnail: { url: 'https://th.example' },
      fields: [{ name: 'n', value: 'v', inline: true }],
    };

    expect(normalizeEmbed(embed)).toEqual({
      title: 'T',
      description: 'D',
      url: 'https://example.com',
      color: 0xff0000,
      timestamp: '2026-08-16T00:00:00.000Z',
      author: { name: 'A', url: 'https://a.example', icon_url: 'https://i.example' },
      footer: { text: 'F', icon_url: 'https://f.example' },
      image: { url: 'https://img.example' },
      thumbnail: { url: 'https://th.example' },
      fields: [{ name: 'n', value: 'v', inline: true }],
    });
  });

  it('omits optional fields that are not provided', () => {
    expect(normalizeEmbed({ title: 'only' })).toEqual({ title: 'only' });
  });
});

describe('embedSchema', () => {
  it('accepts a valid embed', () => {
    expect(embedSchema.safeParse({ title: 'hi', color: '#ff0000' }).success).toBe(true);
  });

  it('rejects a title over 256 characters', () => {
    expect(embedSchema.safeParse({ title: 'x'.repeat(257) }).success).toBe(false);
  });

  it('rejects more than 25 fields', () => {
    const fields = Array.from({ length: 26 }, (_, i) => ({ name: `n${i}`, value: 'v' }));
    expect(embedSchema.safeParse({ fields }).success).toBe(false);
  });

  it('rejects embeds over the 6000-character total', () => {
    expect(embedSchema.safeParse({ title: 'x'.repeat(6001) }).success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  extractInputs,
  extractValues,
  substitutePlaceholders,
  substituteReply,
} from '../../src/actions/substitute.js';

describe('extractValues', () => {
  it('returns the selected values', () => {
    expect(extractValues({ data: { values: ['a', 'b'] } })).toEqual(['a', 'b']);
  });

  it('returns an empty list when there are no values', () => {
    expect(extractValues({ data: { custom_id: 'x' } })).toEqual([]);
    expect(extractValues({})).toEqual([]);
  });
});

describe('extractInputs', () => {
  it('flattens modal component values keyed by custom_id', () => {
    expect(
      extractInputs({
        data: {
          components: [
            {
              components: [
                { custom_id: 'name', value: 'Alice' },
                { custom_id: 'note', value: 'hello' },
              ],
            },
          ],
        },
      }),
    ).toEqual({ name: 'Alice', note: 'hello' });
  });

  it('skips components without a value and returns empty for no data', () => {
    expect(extractInputs({ data: { components: [{ components: [{ custom_id: 'x' }] }] } })).toEqual({});
    expect(extractInputs({})).toEqual({});
  });
});

describe('substitutePlaceholders', () => {
  it('replaces values, indexed values, and inputs', () => {
    expect(
      substitutePlaceholders('You picked {values} ({values.0} and {values.1}) via {input.name}.', ['a', 'b'], {
        name: 'Alice',
      }),
    ).toBe('You picked a, b (a and b) via Alice.');
  });

  it('leaves unrelated text untouched and empties missing placeholders', () => {
    expect(substitutePlaceholders('{values} {values.5} {input.missing}', [], {})).toBe('  ');
  });
});

describe('substituteReply', () => {
  it('substitutes content and embed text', () => {
    const result = substituteReply(
      {
        content: 'Selected {values}',
        embeds: [
          {
            title: 'Pick: {values.0}',
            description: 'By {input.name}',
            fields: [{ name: 'Value', value: '{values.1}' }],
          },
        ],
      },
      ['a', 'b'],
      { name: 'Alice' },
    );

    expect(result).toEqual({
      content: 'Selected a, b',
      embeds: [
        {
          title: 'Pick: a',
          description: 'By Alice',
          fields: [{ name: 'Value', value: 'b' }],
        },
      ],
    });
  });

  it('preserves other embed fields when substituting', () => {
    const result = substituteReply({ embeds: [{ title: 'Hi', color: '#ff0000' }] }, [], {});
    expect(result.embeds).toEqual([{ title: 'Hi', color: '#ff0000' }]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  formatPermissions,
  parsePermissions,
  PERMISSION_BITS,
} from '../../src/tools/permissions.js';

describe('parsePermissions', () => {
  it('combines named permissions into a decimal bitfield string', () => {
    const expected = (PERMISSION_BITS.VIEW_CHANNEL | PERMISSION_BITS.SEND_MESSAGES).toString();
    expect(parsePermissions(['VIEW_CHANNEL', 'SEND_MESSAGES'])).toBe(expected);
  });

  it('returns "0" for an empty list', () => {
    expect(parsePermissions([])).toBe('0');
  });
});

describe('formatPermissions', () => {
  it('splits a bitfield string back into names', () => {
    const bits = (PERMISSION_BITS.VIEW_CHANNEL | PERMISSION_BITS.SEND_MESSAGES).toString();
    expect(formatPermissions(bits)).toEqual(['VIEW_CHANNEL', 'SEND_MESSAGES']);
  });

  it('returns an empty list for "0"', () => {
    expect(formatPermissions('0')).toEqual([]);
  });
});

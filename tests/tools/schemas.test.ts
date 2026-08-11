import { describe, expect, it } from 'vitest';
import { channelType, consent, snowflake } from '../../src/tools/schemas.js';

describe('snowflake', () => {
  it('accepts a 17-20 digit ID', () => {
    expect(snowflake.safeParse('123456789012345678').success).toBe(true);
  });

  it('rejects non-numeric or wrong-length IDs', () => {
    expect(snowflake.safeParse('abc').success).toBe(false);
    expect(snowflake.safeParse('123').success).toBe(false);
    expect(snowflake.safeParse('123456789012345678901').success).toBe(false);
  });
});

describe('consent', () => {
  it('accepts only the literal true', () => {
    expect(consent.safeParse(true).success).toBe(true);
    expect(consent.safeParse(undefined).success).toBe(true);
    expect(consent.safeParse(false).success).toBe(false);
  });
});

describe('channelType', () => {
  it('accepts known channel types only', () => {
    expect(channelType.safeParse('text').success).toBe(true);
    expect(channelType.safeParse('forum').success).toBe(true);
    expect(channelType.safeParse('stage').success).toBe(false);
  });
});

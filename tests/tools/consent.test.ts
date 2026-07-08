import { describe, expect, it } from 'vitest';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { CONSENT_REQUIRED, requireConsent } from '../../src/tools/consent.js';
import { textOf } from '../helpers.js';

describe('requireConsent', () => {
  it('allows the action when consent is true', () => {
    expect(requireConsent(true)).toBeNull();
  });

  it('blocks the action when consent is missing', () => {
    const result = requireConsent(undefined) as CallToolResult;
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(CONSENT_REQUIRED);
  });
});

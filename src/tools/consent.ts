import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { errorResult } from './result.js';

export const CONSENT_REQUIRED =
  'Destructive action requires explicit consent: pass "confirm": true to proceed.';

/** Returns an error result unless the caller passed explicit consent. */
export const requireConsent = (confirm: true | undefined): CallToolResult | null =>
  confirm === true ? null : errorResult(CONSENT_REQUIRED);

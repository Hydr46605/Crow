import { describe, expect, it } from 'vitest';
import {
  DESTRUCTIVE,
  DESTRUCTIVE_IDEMPOTENT,
  IDEMPOTENT,
  OPEN_WORLD,
  READ_ONLY,
} from '../../src/tools/annotations.js';

describe('tool annotations', () => {
  it('marks read-only tools', () => {
    expect(READ_ONLY).toEqual({ readOnlyHint: true });
  });

  it('marks destructive tools', () => {
    expect(DESTRUCTIVE).toEqual({ destructiveHint: true });
  });

  it('marks idempotent writes', () => {
    expect(IDEMPOTENT).toEqual({ idempotentHint: true });
  });

  it('marks destructive-idempotent tools', () => {
    expect(DESTRUCTIVE_IDEMPOTENT).toEqual({ destructiveHint: true, idempotentHint: true });
  });

  it('marks open-world tools', () => {
    expect(OPEN_WORLD).toEqual({ openWorldHint: true });
  });
});

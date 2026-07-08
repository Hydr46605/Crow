import { describe, expect, it } from 'vitest';
import { attempt } from '../../src/tools/attempt.js';

describe('attempt', () => {
  it('returns ok with the value on success', async () => {
    await expect(attempt(async () => 42)).resolves.toEqual({ ok: true, value: 42 });
  });

  it('returns not-ok with the message on failure', async () => {
    const result = await attempt(async () => {
      throw new Error('boom');
    });
    expect(result).toEqual({ ok: false, error: 'boom' });
  });
});

import { describe, expect, it } from 'vitest';
import { maskToken, redactSecrets } from '../../src/security/redact.js';

describe('maskToken', () => {
  it('masks the middle of a long token', () => {
    expect(maskToken('abcdefghijklmnop')).toBe('abcd****mnop');
  });

  it('fully masks short tokens', () => {
    expect(maskToken('abc')).toBe('********');
  });
});

describe('redactSecrets', () => {
  it('replaces secret occurrences with [REDACTED]', () => {
    expect(redactSecrets('token=abc123 in log', ['abc123'])).toBe('token=[REDACTED] in log');
  });

  it('replaces every occurrence of every secret', () => {
    expect(redactSecrets('a=one b=two one', ['one', 'two'])).toBe(
      'a=[REDACTED] b=[REDACTED] [REDACTED]',
    );
  });

  it('returns the text unchanged when no secrets match', () => {
    expect(redactSecrets('no secrets here', ['xyz'])).toBe('no secrets here');
  });

  it('ignores empty secrets', () => {
    expect(redactSecrets('unchanged', [''])).toBe('unchanged');
  });
});

import { describe, expect, it } from 'vitest';
import { ping } from '../../src/tools/ping.js';

describe('ping', () => {
  it('responds with pong when no message is provided', () => {
    expect(ping({})).toBe('pong');
  });

  it('echoes the message when provided', () => {
    expect(ping({ message: 'hello' })).toBe('pong: hello');
  });
});

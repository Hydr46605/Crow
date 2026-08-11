import { describe, expect, it } from 'vitest';
import { bold, cyan, dim, green, paint, red, yellow } from '../../src/cli/colors.js';

describe('paint', () => {
  it('wraps text with the code and resets afterwards', () => {
    expect(paint('\x1b[31m', 'x')).toBe('\x1b[31mx\x1b[0m');
  });
});

describe('color helpers', () => {
  it('bold uses the bold code', () => {
    expect(bold('x')).toBe('\x1b[1mx\x1b[0m');
  });

  it('each color maps to its ANSI code', () => {
    expect(red('x')).toContain('\x1b[31m');
    expect(green('x')).toContain('\x1b[32m');
    expect(yellow('x')).toContain('\x1b[33m');
    expect(cyan('x')).toContain('\x1b[36m');
    expect(dim('x')).toContain('\x1b[2m');
  });
});

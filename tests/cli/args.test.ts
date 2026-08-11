import { describe, expect, it } from 'vitest';
import { parseArgs } from '../../src/cli/args.js';

describe('parseArgs', () => {
  it('defaults to serve with no arguments', () => {
    expect(parseArgs([])).toEqual({ kind: 'serve' });
  });

  it('maps serve aliases', () => {
    for (const arg of ['serve', 'run', 'start']) {
      expect(parseArgs([arg])).toEqual({ kind: 'serve' });
    }
  });

  it('maps setup aliases', () => {
    for (const arg of ['setup', 'wizard', 'init']) {
      expect(parseArgs([arg])).toEqual({ kind: 'setup' });
    }
  });

  it('maps doctor aliases', () => {
    for (const arg of ['doctor', 'check']) {
      expect(parseArgs([arg])).toEqual({ kind: 'doctor' });
    }
  });

  it('maps version aliases', () => {
    for (const arg of ['--version', '-v', 'version']) {
      expect(parseArgs([arg])).toEqual({ kind: 'version' });
    }
  });

  it('maps help aliases', () => {
    for (const arg of ['--help', '-h', 'help']) {
      expect(parseArgs([arg])).toEqual({ kind: 'help' });
    }
  });

  it('reports unknown commands', () => {
    expect(parseArgs(['frobnicate'])).toEqual({ kind: 'unknown', arg: 'frobnicate' });
  });
});

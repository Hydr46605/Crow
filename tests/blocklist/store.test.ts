import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { envOverrides, loadBlocklist, readBlocklistFile, writeBlocklistFile } from '../../src/blocklist/store.js';

const valid: Parameters<typeof writeBlocklistFile>[1] = {
  tools: ['delete_channel'],
  categories: ['destructive'],
  routes: [{ method: 'DELETE', pattern: '/channels/*/messages/*' }],
  guilds: ['123456789012345678'],
};

describe('readBlocklistFile', () => {
  it('returns an empty blocklist for a missing file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'crow-blocklist-'));
    try {
      expect(readBlocklistFile(join(dir, 'nope.json'))).toEqual({
        tools: [],
        categories: [],
        routes: [],
        guilds: [],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns an empty blocklist for invalid JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'crow-blocklist-'));
    try {
      const path = join(dir, 'blocklist.json');
      writeBlocklistFile(path, { tools: [], categories: [], routes: [], guilds: ['not-a-snowflake'] } as never);
      // The invalid guild fails validation, so the whole file reads empty.
      expect(readBlocklistFile(path)).toEqual({ tools: [], categories: [], routes: [], guilds: [] });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('writeBlocklistFile / readBlocklistFile roundtrip', () => {
  it('persists and reads back the rules', () => {
    const dir = mkdtempSync(join(tmpdir(), 'crow-blocklist-'));
    try {
      const path = join(dir, 'blocklist.json');
      writeBlocklistFile(path, valid);
      expect(readBlocklistFile(path)).toEqual(valid);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('envOverrides', () => {
  it('parses comma-separated lists and route entries', () => {
    expect(
      envOverrides({
        CROW_BLOCK_TOOLS: 'delete_channel, send_message',
        CROW_BLOCK_CATEGORIES: 'write,open_world',
        CROW_BLOCK_ROUTES: 'DELETE:/channels/*/messages/*, GET:/guilds/*',
        CROW_BLOCK_GUILDS: '1, 2',
      }),
    ).toEqual({
      tools: ['delete_channel', 'send_message'],
      categories: ['write', 'open_world'],
      routes: [
        { method: 'DELETE', pattern: '/channels/*/messages/*' },
        { method: 'GET', pattern: '/guilds/*' },
      ],
      guilds: ['1', '2'],
    });
  });

  it('returns empty lists when no overrides are set', () => {
    expect(envOverrides({})).toEqual({ tools: [], categories: [], routes: [], guilds: [] });
  });
});

describe('loadBlocklist', () => {
  it('merges the file with env overrides and dedupes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'crow-blocklist-'));
    try {
      const path = join(dir, 'blocklist.json');
      writeBlocklistFile(path, { tools: ['delete_channel'], categories: [], routes: [], guilds: [] });

      const loaded = loadBlocklist(path, {
        CROW_BLOCK_TOOLS: 'delete_channel, send_message',
        CROW_BLOCK_CATEGORIES: 'write',
      });

      expect(loaded).toEqual({
        tools: ['delete_channel', 'send_message'],
        categories: ['write'],
        routes: [],
        guilds: [],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

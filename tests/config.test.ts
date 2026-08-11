import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, configFilePath, loadConfig, saveConfig } from '../src/config.js';

const validEnv = {
  CROW_BOT_USER_ID: '123456789012345678',
  CROW_BOT_TOKEN: 'secret-token',
};

describe('loadConfig', () => {
  it('returns parsed credentials from a valid environment', () => {
    expect(loadConfig(validEnv)).toEqual({
      botUserId: '123456789012345678',
      botToken: 'secret-token',
    });
  });

  it('trims whitespace from credential values', () => {
    const config = loadConfig({
      CROW_BOT_USER_ID: '  123456789012345678  ',
      CROW_BOT_TOKEN: '  secret-token  ',
    });

    expect(config.botUserId).toBe('123456789012345678');
    expect(config.botToken).toBe('secret-token');
  });

  it('throws ConfigError when the bot user id is missing', () => {
    expect(() => loadConfig({ CROW_BOT_TOKEN: 'secret-token' })).toThrow(ConfigError);
  });

  it('throws ConfigError when the bot token is missing', () => {
    expect(() => loadConfig({ CROW_BOT_USER_ID: '123456789012345678' })).toThrow(ConfigError);
  });

  it('throws ConfigError when the environment is empty', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
  });

  it('throws ConfigError when the bot user id is not a snowflake', () => {
    expect(() =>
      loadConfig({ CROW_BOT_USER_ID: 'not-a-snowflake', CROW_BOT_TOKEN: 'secret-token' }),
    ).toThrow(ConfigError);
  });

  it('throws ConfigError when the bot token contains whitespace', () => {
    expect(() =>
      loadConfig({ CROW_BOT_USER_ID: '123456789012345678', CROW_BOT_TOKEN: 'bad token' }),
    ).toThrow(ConfigError);
  });
});

describe('saveConfig', () => {
  it('writes credentials to the given path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'crow-config-'));
    try {
      const path = join(dir, '.env');
      const written = saveConfig({ botUserId: '123456789012345678', botToken: 'tok' }, path);

      expect(written).toBe(path);
      expect(readFileSync(path, 'utf8')).toBe(
        'CROW_BOT_USER_ID=123456789012345678\nCROW_BOT_TOKEN=tok\n',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('creates parent directories as needed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'crow-config-'));
    try {
      const path = join(dir, 'nested', '.env');
      saveConfig({ botUserId: '123456789012345678', botToken: 'tok' }, path);
      expect(readFileSync(path, 'utf8')).toContain('CROW_BOT_TOKEN=tok');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('configFilePath', () => {
  it('points into the .crow home directory', () => {
    expect(configFilePath().endsWith(join('.crow', '.env'))).toBe(true);
  });
});

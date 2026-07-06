import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config.js';

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

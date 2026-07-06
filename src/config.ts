import { SNOWFLAKE_PATTERN } from './discord/snowflake.js';

export interface CrowConfig {
  /** Snowflake user ID of the bot account Crow acts as. */
  readonly botUserId: string;
  /** Bot token from the Discord Developer Portal. */
  readonly botToken: string;
}

export const BOT_USER_ID_VAR = 'CROW_BOT_USER_ID';
export const BOT_TOKEN_VAR = 'CROW_BOT_TOKEN';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Reads and validates Crow configuration from the environment.
 *
 * This is the single source of truth for how credentials reach the rest of the
 * application. It fails fast with an actionable message when a value is missing
 * or malformed, and never logs the token.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): CrowConfig {
  const botUserId = env[BOT_USER_ID_VAR]?.trim();
  const botToken = env[BOT_TOKEN_VAR]?.trim();

  if (!botUserId || !botToken) {
    const missing = [
      !botUserId ? BOT_USER_ID_VAR : null,
      !botToken ? BOT_TOKEN_VAR : null,
    ].filter((name): name is string => name !== null);

    throw new ConfigError(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Copy .env.example to .env and set your Discord bot credentials.',
    );
  }

  if (!SNOWFLAKE_PATTERN.test(botUserId)) {
    throw new ConfigError(`${BOT_USER_ID_VAR} must be a Discord snowflake ID (17-20 digits).`);
  }

  if (/\s/.test(botToken)) {
    throw new ConfigError(`${BOT_TOKEN_VAR} must not contain whitespace.`);
  }

  return { botUserId, botToken };
}

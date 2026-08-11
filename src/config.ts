import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { SNOWFLAKE_PATTERN } from './discord/snowflake.js';

export interface CrowConfig {
  /** Snowflake user ID of the bot account Crow acts as. */
  readonly botUserId: string;
  /** Bot token from the Discord Developer Portal. */
  readonly botToken: string;
}

export const BOT_USER_ID_VAR = 'CROW_BOT_USER_ID';
export const BOT_TOKEN_VAR = 'CROW_BOT_TOKEN';

/** Install/configuration directory. Override with the `CROW_HOME` environment variable. */
export const CROW_HOME = process.env.CROW_HOME ?? join(homedir(), '.crow');

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Loads configuration from `.env` files without overriding already-set
 * environment variables (so MCP clients that pass credentials inline win).
 *
 * Order: project-local `.env` first, then `$CROW_HOME/.env`.
 */
export function loadEnvFiles(): void {
  loadDotenv({ path: join(process.cwd(), '.env') });
  loadDotenv({ path: join(CROW_HOME, '.env') });
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
        'Run `crow setup` to configure your bot, or set them in your environment.',
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

/** Path of the user-level `.env` file that `loadEnvFiles` reads. */
export const configFilePath = (): string => join(CROW_HOME, '.env');

/**
 * Persists credentials to the user-level `.env` file (owner-readable).
 *
 * Returns the path written. The token is stored verbatim so the server can read
 * it back on startup; the file is created with `0600` permissions where the
 * platform supports them.
 */
export const saveConfig = (config: CrowConfig, path: string = configFilePath()): string => {
  mkdirSync(dirname(path), { recursive: true });
  const content = `${BOT_USER_ID_VAR}=${config.botUserId}\n${BOT_TOKEN_VAR}=${config.botToken}\n`;
  writeFileSync(path, content, { encoding: 'utf8', mode: 0o600 });
  return path;
};

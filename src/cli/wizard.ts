import { configFilePath, saveConfig } from '../config.js';
import { DiscordClient } from '../discord/client.js';
import { SNOWFLAKE_PATTERN } from '../discord/snowflake.js';
import { VERSION } from '../version.js';
import { bold, cyan } from './colors.js';
import { hasMissingIntents } from './checker.js';
import { printDoctorReport, runDoctor, type DoctorResult } from './doctor.js';
import { ask, askHidden, confirm, failure, info, success, warning } from './ui.js';

interface ValidatedToken {
  readonly token: string;
  readonly result: DoctorResult;
}

const printBanner = (): void => {
  process.stdout.write(`\n${bold('Crow')} ${cyan(`v${VERSION}`)} — setup wizard\n`);
  info(`Credentials will be stored at ${configFilePath()}`);
};

/**
 * Prompts for a bot token until Discord accepts one.
 *
 * Each attempt is verified against `GET /users/@me`; a 401 means the token is
 * rejected and the user is asked again. The token is never echoed.
 */
const promptForToken = async (): Promise<ValidatedToken> => {
  for (;;) {
    const token = await askHidden('Bot token:');
    if (!token) {
      failure('Token cannot be empty.');
      continue;
    }
    if (/\s/.test(token)) {
      failure('Token must not contain whitespace.');
      continue;
    }

    const result = await runDoctor(new DiscordClient(token));
    if (!result.tokenValid) {
      failure(result.error ? `Discord rejected the token: ${result.error}` : 'Discord rejected that token.');
      continue;
    }
    return { token, result };
  }
};

/**
 * Confirms the auto-detected bot user ID, falling back to manual entry.
 *
 * The ID comes from `/users/@me`, so it only needs asking when detection fails.
 */
const promptForUserId = async (detected?: string): Promise<string> => {
  if (detected && SNOWFLAKE_PATTERN.test(detected)) {
    if (await confirm(`Use detected bot user ID ${detected}?`)) {
      return detected;
    }
  }

  for (;;) {
    const id = await ask('Bot user ID:');
    if (SNOWFLAKE_PATTERN.test(id)) return id;
    failure(
      'Enter the bot user ID (17-20 digit snowflake) — Developer Portal → Bot, next to the bot username.',
    );
  }
};

/**
 * Shows the intent report and offers to re-check after the user fixes gaps.
 *
 * Loops until every required intent is enabled or the user chooses to proceed
 * without them, so the "enable then recheck" flow the user asked for is built in.
 */
const ensureIntents = async (discord: DiscordClient, initial: DoctorResult): Promise<void> => {
  let result = initial;
  for (;;) {
    printDoctorReport(result);
    if (!result.intents || !hasMissingIntents(result.intents)) {
      if (result.intents) success('All required privileged intents are enabled.');
      break;
    }

    warning('Enable the missing privileged intents in the Discord Developer Portal.');
    if (!(await confirm('Fixed them? Recheck now?'))) {
      warning('Continuing without the missing intents — some tools will fail until they are enabled.');
      break;
    }
    result = await runDoctor(discord);
  }
};

/** Runs the full interactive setup: token → user ID → intents → save. */
export const runWizard = async (): Promise<void> => {
  printBanner();

  const { token, result } = await promptForToken();
  const userId = await promptForUserId(result.identity?.id);

  await ensureIntents(new DiscordClient(token), result);

  const path = saveConfig({ botUserId: userId, botToken: token });
  success(`Credentials saved to ${path}`);
  info('');
  info('Point your MCP client at the `crow` command (stdio).');
  info('Verify anytime with `crow doctor`.');
};

import { loadConfig } from '../config.js';
import { DiscordClient, DiscordRequestError } from '../discord/client.js';
import { reportIntents, type IntentReport } from './checker.js';
import { bold, cyan, dim, green, red, yellow } from './colors.js';

/** The bot user returned by `GET /users/@me`. */
export interface BotIdentity {
  readonly id: string;
  readonly username: string;
  readonly bot?: boolean;
}

/** The application object returned by `GET /applications/@me`. */
export interface BotApplication {
  readonly id: string;
  readonly name: string;
  readonly flags: number;
}

export interface DoctorResult {
  readonly tokenValid: boolean;
  readonly identity?: BotIdentity;
  readonly application?: BotApplication;
  readonly intents?: IntentReport;
  readonly error?: string;
}

/**
 * Checks a Discord token and its privileged intents.
 *
 * `GET /users/@me` proves the token is usable; a 401 means the token was
 * rejected. `GET /applications/@me` exposes the gateway intent flags.
 */
export const runDoctor = async (discord: DiscordClient): Promise<DoctorResult> => {
  let identity: BotIdentity;
  try {
    identity = await discord.request<BotIdentity>('GET', '/users/@me');
  } catch (error) {
    if (error instanceof DiscordRequestError && error.statusCode === 401) {
      return { tokenValid: false };
    }
    return {
      tokenValid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    const application = await discord.request<BotApplication>('GET', '/applications/@me');
    return {
      tokenValid: true,
      identity,
      application,
      intents: reportIntents(application.flags),
    };
  } catch (error) {
    return {
      tokenValid: true,
      identity,
      error: `Token is valid, but reading application intents failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
};

export interface DoctorSummary {
  readonly healthy: boolean;
  readonly problems: readonly string[];
}

/** Reduces a doctor result to a health flag and human-readable problems. */
export const summarizeDoctor = (result: DoctorResult): DoctorSummary => {
  const problems: string[] = [];

  if (!result.tokenValid) {
    problems.push(result.error ?? 'Bot token is invalid or unauthorized.');
  } else if (result.error) {
    problems.push(result.error);
  }

  if (result.intents) {
    if (result.intents.guildMembers === 'disabled') {
      problems.push('GUILD_MEMBERS intent is disabled — list_members will fail.');
    }
    if (result.intents.messageContent === 'disabled') {
      problems.push('MESSAGE_CONTENT intent is disabled — read_messages will return empty content.');
    }
  }

  return { healthy: problems.length === 0, problems };
};

const intentLabel = (state: IntentReport['guildMembers']): string => {
  switch (state) {
    case 'enabled':
      return green('enabled');
    case 'limited':
      return yellow('limited');
    default:
      return red('disabled');
  }
};

const printIntent = (name: string, state: IntentReport['guildMembers']): void => {
  process.stdout.write(`  ${name.padEnd(16)} ${intentLabel(state)}\n`);
};

/** Renders the doctor's findings to stdout (no secrets). */
export const printDoctorReport = (result: DoctorResult): void => {
  process.stdout.write(`\n${bold('Crow')} ${cyan('doctor')}\n\n`);

  if (result.tokenValid) {
    process.stdout.write(`${green('✓')} Bot token is valid.\n`);
    if (result.identity) {
      process.stdout.write(
        `  ${dim(`@${result.identity.username}`)} (${dim(result.identity.id)})\n`,
      );
    }
  } else {
    process.stdout.write(`${red('✗')} Bot token is invalid.\n`);
    if (result.error) {
      process.stdout.write(`${yellow('!')} ${result.error}\n`);
    }
  }

  if (result.intents) {
    process.stdout.write(`\n${bold('Privileged intents')}\n`);
    printIntent('GUILD_MEMBERS', result.intents.guildMembers);
    printIntent('MESSAGE_CONTENT', result.intents.messageContent);
  } else if (result.tokenValid && result.error) {
    process.stdout.write(`\n${yellow('!')} ${result.error}\n`);
  }

  const missingIntents = result.intents
    ? [result.intents.guildMembers, result.intents.messageContent].filter((s) => s === 'disabled')
    : [];
  if (missingIntents.length > 0) {
    process.stdout.write(`\n${yellow('!')} Required intents are missing; some tools will fail.`);
    process.stdout.write(
      `\n${dim('Fix: Discord Developer Portal → your app → Bot → Privileged Gateway Intents.')}\n`,
    );
  }

  process.stdout.write('\n');
};

/** Doctor CLI command: load config, check, print, and exit non-zero if unhealthy. */
export const runDoctorCli = async (): Promise<void> => {
  const config = loadConfig();
  const discord = new DiscordClient(config.botToken);
  const result = await runDoctor(discord);
  printDoctorReport(result);

  if (!summarizeDoctor(result).healthy) {
    // Set the exit code rather than calling process.exit(): an abrupt exit while
    // Discord's REST handles are still closing triggers a libuv assertion on Windows.
    process.exitCode = 1;
  }
};

import { bold, cyan } from './colors.js';
import { VERSION } from '../version.js';

export const printHelp = (): void => {
  process.stdout.write(
    [
      '',
      `${bold('Crow')} ${cyan(`v${VERSION}`)} — a Discord toolkit for AI agents (MCP server).`,
      '',
      `${bold('Usage:')} crow [command]`,
      '',
      `${bold('Commands:')}`,
      '  (none)             Run the MCP server over stdio.',
      '  serve              Run the MCP server over stdio.',
      '  setup, wizard      Run the interactive setup wizard.',
      '  doctor, check      Check the bot token and privileged intents.',
      '  --version, -v      Print the version.',
      '  --help, -h         Show this help.',
      '',
    ].join('\n'),
  );
};

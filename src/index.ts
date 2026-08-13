#!/usr/bin/env node

import { parseArgs } from './cli/args.js';
import { runDoctorCli } from './cli/doctor.js';
import { printHelp } from './cli/help.js';
import { runWizard } from './cli/wizard.js';
import { loadEnvFiles } from './config.js';
import { gateway } from './gateway/transport.js';
import { handleFatal, serve } from './serve.js';
import { VERSION } from './version.js';

/**
 * `crow` command dispatcher.
 *
 * With no arguments it behaves as an MCP server over stdio; the subcommands
 * (`setup`, `doctor`, `--version`, `--help`) drive the developer-facing CLI.
 */
const main = async (): Promise<void> => {
  loadEnvFiles();

  const command = parseArgs(process.argv.slice(2));
  switch (command.kind) {
    case 'serve':
      await serve();
      return;
    case 'setup':
      await runWizard();
      return;
    case 'doctor':
      await runDoctorCli();
      return;
    case 'gateway':
      await gateway();
      return;
    case 'version':
      process.stdout.write(`${VERSION}\n`);
      return;
    case 'help':
      printHelp();
      return;
    case 'unknown':
      process.stderr.write(`Unknown command: ${command.arg}\n\n`);
      printHelp();
      process.exit(2);
  }
};

void main().catch(handleFatal);

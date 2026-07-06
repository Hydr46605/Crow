#!/usr/bin/env node

import 'dotenv/config';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ConfigError, loadConfig } from './config.js';
import { DiscordClient } from './discord/client.js';
import { createServer } from './server.js';

const run = async (): Promise<void> => {
  const config = loadConfig();
  const discord = new DiscordClient(config.botToken);
  const server = createServer({ config, discord });

  const shutdown = async (): Promise<void> => {
    await server.close();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());

  const transport = new StdioServerTransport();
  await server.connect(transport);
};

run().catch((error: unknown) => {
  // stderr is safe here; stdout is reserved for the MCP protocol.
  if (error instanceof ConfigError) {
    console.error(`[crow] ${error.message}`);
  } else {
    console.error('[crow] failed to start:', error);
  }
  process.exit(1);
});

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BOT_TOKEN_VAR, loadConfig } from './config.js';
import { DiscordClient } from './discord/client.js';
import { redactSecrets } from './security/redact.js';
import { createServer } from './server.js';

/** Boots the MCP server over stdio. */
export const serve = async (): Promise<void> => {
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

/** Prints a redacted fatal error to stderr and exits non-zero. */
export const handleFatal = (error: unknown): void => {
  // stderr is safe here; stdout is reserved for the MCP protocol. Never log the token.
  const token = process.env[BOT_TOKEN_VAR] ?? '';
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[crow] ${redactSecrets(message, [token])}\n`);
  process.exit(1);
};

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CrowConfig } from './config.js';
import type { CrowContext } from './context.js';
import type { DiscordClient } from './discord/client.js';
import { registerTools } from './tools/index.js';
import { NAME, VERSION } from './version.js';

export interface CreateServerOptions {
  readonly config: CrowConfig;
  readonly discord: DiscordClient;
}

/** Builds a fully-wired MCP server with all tools registered. */
export const createServer = ({ config, discord }: CreateServerOptions): McpServer => {
  const server = new McpServer({ name: NAME, version: VERSION });

  const ctx: CrowContext = { config, discord };
  registerTools(server, ctx);

  return server;
};

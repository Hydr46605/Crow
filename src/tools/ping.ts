import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CrowContext } from '../context.js';
import { READ_ONLY } from './annotations.js';

const inputSchema = {
  message: z.string().min(1).optional().describe('Optional message to echo back.'),
};

export interface PingInput {
  readonly message?: string;
}

/** Pure handler: unit-testable without touching the MCP layer. */
export const ping = (input: PingInput): string =>
  input.message ? `pong: ${input.message}` : 'pong';

/** Registers the `ping` tool on the given server. */
export const registerPingTool = (server: McpServer, _ctx: CrowContext): void => {
  server.registerTool(
    'ping',
    {
      title: 'Ping',
      description: 'Respond with "pong" to verify the server is reachable.',
      inputSchema,
      annotations: READ_ONLY,
    },
    async (args) => ({ content: [{ type: 'text', text: ping(args) }] }),
  );
};

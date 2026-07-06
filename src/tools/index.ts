import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CrowContext } from '../context.js';
import { registerPingTool } from './ping.js';

export type ToolRegistrar = (server: McpServer, ctx: CrowContext) => void;

/**
 * The single registry every tool module plugs into.
 *
 * Add a capability by dropping its `register<Name>Tool` function here.
 */
const registrars: readonly ToolRegistrar[] = [registerPingTool];

export const registerTools = (server: McpServer, ctx: CrowContext): void => {
  for (const register of registrars) {
    register(server, ctx);
  }
};

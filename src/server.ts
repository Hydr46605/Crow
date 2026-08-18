import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ActionRuntime } from './actions/runtime.js';
import type { BlocklistRuntime } from './blocklist/runtime.js';
import type { CrowConfig } from './config.js';
import type { CrowContext } from './context.js';
import type { DiscordClient } from './discord/client.js';
import type { NoteRuntime } from './notes/runtime.js';
import { registerTools } from './tools/index.js';
import { NAME, VERSION } from './version.js';

export interface CreateServerOptions {
  readonly config: CrowConfig;
  readonly discord: DiscordClient;
  readonly actions: ActionRuntime;
  readonly notes: NoteRuntime;
  readonly blocklist: BlocklistRuntime;
}

const INSTRUCTIONS = [
  'Crow is a Discord toolkit for AI agents. Most actions are per-guild: use list_guilds',
  'to pick a guild, then list_channels/list_members to find targets, then act.',
  'Use add_note/list_notes to persist context about objects across sessions, and',
  'get_guild_overview for a one-call orientation of a guild.',
  'Destructive tools (kick, ban, delete_*, bulk_delete_messages) require an explicit',
  '"confirm": true argument and refuse otherwise. Check tool annotations',
  '(readOnlyHint, destructiveHint, idempotentHint) before acting, and prefer typed tools',
  'over discord_request. Registered component actions are dispatched live by the',
  'crow gateway daemon.',
].join(' ');

/** Builds a fully-wired MCP server with all tools registered. */
export const createServer = ({ config, discord, actions, notes, blocklist }: CreateServerOptions): McpServer => {
  const server = new McpServer({ name: NAME, version: VERSION }, { instructions: INSTRUCTIONS });

  const ctx: CrowContext = { config, discord, actions, notes, blocklist };
  registerTools(server, ctx);

  return server;
};

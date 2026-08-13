import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CrowContext } from '../context.js';
import { registerActionTools } from './actions.js';
import { registerChannelTools } from './channels.js';
import { registerEmbedTools } from './embeds.js';
import { registerEmojiTools } from './emojis.js';
import { registerGuildTools } from './guilds.js';
import { registerInviteTools } from './invites.js';
import { registerMemberTools } from './members.js';
import { registerMessageTools } from './messages.js';
import { registerModerationTools } from './moderation.js';
import { registerPingTool } from './ping.js';
import { registerRawTool } from './raw.js';
import { registerStickerTools } from './stickers.js';
import { registerWebhookTools } from './webhooks.js';

export type ToolRegistrar = (server: McpServer, ctx: CrowContext) => void;

/**
 * The single registry every tool module plugs into.
 *
 * Add a capability by dropping its `register<Name>Tool(s)` function here.
 */
const registrars: readonly ToolRegistrar[] = [
  registerPingTool,
  registerGuildTools,
  registerMemberTools,
  registerMessageTools,
  registerChannelTools,
  registerModerationTools,
  registerEmbedTools,
  registerWebhookTools,
  registerInviteTools,
  registerEmojiTools,
  registerStickerTools,
  registerActionTools,
  registerRawTool,
];

export const registerTools = (server: McpServer, ctx: CrowContext): void => {
  for (const register of registrars) {
    register(server, ctx);
  }
};

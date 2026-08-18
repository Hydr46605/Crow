import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { installBlocklistGuard } from '../blocklist/guard.js';
import type { CrowContext } from '../context.js';
import { registerActionTools } from './actions.js';
import { registerAuditLogTools } from './audit-log.js';
import { registerBoostTools } from './boost.js';
import { registerChannelTools } from './channels.js';
import { registerCommunityTools } from './community.js';
import { registerDmTools } from './dms.js';
import { registerEmbedTools } from './embeds.js';
import { registerEmojiTools } from './emojis.js';
import { registerGuildTools } from './guilds.js';
import { registerInviteTools } from './invites.js';
import { registerMemberTools } from './members.js';
import { registerMessageTools } from './messages.js';
import { registerModerationTools } from './moderation.js';
import { registerNoteTools } from './notes.js';
import { registerOverviewTools } from './overview.js';
import { registerPingTool } from './ping.js';
import { registerProfileTools } from './profile.js';
import { registerRawTool } from './raw.js';
import { registerReactionTools } from './reactions.js';
import { registerRoleTools } from './roles.js';
import { registerStickerTools } from './stickers.js';
import { registerVoiceTools } from './voice.js';
import { registerWaitTool } from './wait.js';
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
  registerOverviewTools,
  registerMemberTools,
  registerMessageTools,
  registerWaitTool,
  registerChannelTools,
  registerCommunityTools,
  registerDmTools,
  registerRoleTools,
  registerReactionTools,
  registerAuditLogTools,
  registerBoostTools,
  registerModerationTools,
  registerProfileTools,
  registerEmbedTools,
  registerWebhookTools,
  registerInviteTools,
  registerEmojiTools,
  registerStickerTools,
  registerVoiceTools,
  registerActionTools,
  registerNoteTools,
  registerRawTool,
];

export const registerTools = (server: McpServer, ctx: CrowContext): void => {
  installBlocklistGuard(server, ctx);
  for (const register of registrars) {
    register(server, ctx);
  }
};

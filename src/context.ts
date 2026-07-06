import type { CrowConfig } from './config.js';
import type { DiscordClient } from './discord/client.js';

/**
 * Shared dependencies passed to every tool handler.
 *
 * Keeping config and the Discord client behind this type means tools depend on
 * an explicit, narrow interface instead of reaching for globals.
 */
export interface CrowContext {
  readonly config: CrowConfig;
  readonly discord: DiscordClient;
}

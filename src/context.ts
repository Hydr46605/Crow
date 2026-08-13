import type { ActionRuntime } from './actions/runtime.js';
import type { CrowConfig } from './config.js';
import type { DiscordClient } from './discord/client.js';

/**
 * Shared dependencies passed to every tool handler.
 *
 * Keeping config, the Discord client, and the action runtime behind this type
 * means tools depend on an explicit, narrow interface instead of reaching for
 * globals.
 */
export interface CrowContext {
  readonly config: CrowConfig;
  readonly discord: DiscordClient;
  readonly actions: ActionRuntime;
}

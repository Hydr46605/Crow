import type { ActionRuntime } from './actions/runtime.js';
import type { BlocklistRuntime } from './blocklist/runtime.js';
import type { CrowConfig } from './config.js';
import type { DiscordClient } from './discord/client.js';
import type { NoteRuntime } from './notes/runtime.js';

/**
 * Shared dependencies passed to every tool handler.
 *
 * Keeping config, the Discord client, the action runtime, the note store, and
 * the blocklist behind this type means tools depend on an explicit, narrow
 * interface instead of reaching for globals.
 */
export interface CrowContext {
  readonly config: CrowConfig;
  readonly discord: DiscordClient;
  readonly actions: ActionRuntime;
  readonly notes: NoteRuntime;
  readonly blocklist: BlocklistRuntime;
}

/**
 * Discord application flags for privileged gateway intents.
 *
 * These bits come from the `flags` field of the application object returned by
 * `GET /applications/@me`. Crow needs `GUILD_MEMBERS` for member listing and
 * `MESSAGE_CONTENT` to read message text, so the doctor checks both.
 */
export const GATEWAY_GUILD_MEMBERS = 1 << 14;
export const GATEWAY_GUILD_MEMBERS_LIMITED = 1 << 15;
export const GATEWAY_MESSAGE_CONTENT = 1 << 18;
export const GATEWAY_MESSAGE_CONTENT_LIMITED = 1 << 19;

/** How a privileged intent is configured for the application. */
export type IntentState = 'enabled' | 'limited' | 'disabled';

export interface IntentReport {
  readonly guildMembers: IntentState;
  readonly messageContent: IntentState;
}

const stateFor = (flags: number, full: number, limited: number): IntentState => {
  if ((flags & full) !== 0) return 'enabled';
  if ((flags & limited) !== 0) return 'limited';
  return 'disabled';
};

/** Maps raw application flags to the two intents Crow cares about. */
export const reportIntents = (flags: number): IntentReport => ({
  guildMembers: stateFor(flags, GATEWAY_GUILD_MEMBERS, GATEWAY_GUILD_MEMBERS_LIMITED),
  messageContent: stateFor(flags, GATEWAY_MESSAGE_CONTENT, GATEWAY_MESSAGE_CONTENT_LIMITED),
});

/** True when any required intent is fully disabled (a hard blocker). */
export const hasMissingIntents = (intents: IntentReport): boolean =>
  intents.guildMembers === 'disabled' || intents.messageContent === 'disabled';

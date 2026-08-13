import type { DiscordEmbed } from '../tools/embeds.js';
import { normalizeEmbed } from '../tools/embeds.js';
import { actionsFilePath, readActionsFile, writeActionsFile } from './store.js';
import type { Action } from './types.js';

/** The minimal Discord interaction shape the runtime needs to resolve. */
export interface InteractionPayload {
  readonly data?: { readonly custom_id?: string };
}

/** A Discord interaction callback of type 4 (channel message with source). */
export interface InteractionReply {
  readonly type: 4;
  readonly data: {
    readonly content?: string;
    readonly embeds?: DiscordEmbed[];
    readonly flags?: number;
  };
}

export interface InteractionDispatch {
  readonly matched: boolean;
  readonly customId?: string;
  readonly reply?: InteractionReply;
}

/** Discord flag marking a reply as ephemeral (visible only to the invoker). */
export const EPHEMERAL_FLAG = 64;

/**
 * Pure hook: resolves an interaction against a set of registered actions.
 *
 * This is the extension point the future Gateway transport calls. It maps a
 * component's `custom_id` to its registered reply and returns the type-4
 * callback payload (or `{ matched: false }` when nothing is registered).
 */
export const resolveInteraction = (
  actions: ReadonlyMap<string, Action>,
  interaction: InteractionPayload,
): InteractionDispatch => {
  const customId = interaction.data?.custom_id;
  if (customId === undefined) return { matched: false };

  const action = actions.get(customId);
  if (!action) return { matched: false, customId };

  const data: { content?: string; embeds?: DiscordEmbed[]; flags?: number } = {};
  if (action.content !== undefined) data.content = action.content;
  if (action.embeds !== undefined) data.embeds = action.embeds.map(normalizeEmbed);
  if (action.ephemeral) data.flags = EPHEMERAL_FLAG;

  return { matched: true, customId, reply: { type: 4, data } };
};

/**
 * In-memory action registry, backed by a JSON file under `CROW_HOME`.
 *
 * Actions are loaded once at startup and persisted on every mutation.
 */
export class ActionRuntime {
  private readonly actions = new Map<string, Action>();

  constructor(private readonly storePath: string = actionsFilePath()) {}

  /** Loads persisted actions into memory. Missing or invalid files load as empty. */
  load(): void {
    for (const action of readActionsFile(this.storePath)) {
      this.actions.set(action.customId, action);
    }
  }

  private persist(): void {
    writeActionsFile(this.storePath, this.list());
  }

  /** Registers or replaces the action for `action.customId`. */
  register(action: Action): Action {
    this.actions.set(action.customId, action);
    this.persist();
    return action;
  }

  list(): Action[] {
    return [...this.actions.values()];
  }

  /** Removes the action for `customId`, returning whether one existed. */
  remove(customId: string): boolean {
    const removed = this.actions.delete(customId);
    if (removed) this.persist();
    return removed;
  }

  resolve(interaction: InteractionPayload): InteractionDispatch {
    return resolveInteraction(this.actions, interaction);
  }
}

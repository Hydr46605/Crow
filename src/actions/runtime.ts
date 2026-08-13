import { normalizeTextInputs } from '../tools/components.js';
import type { DiscordEmbed } from '../tools/embeds.js';
import { normalizeEmbed } from '../tools/embeds.js';
import { actionsFilePath, readActionsFile, writeActionsFile } from './store.js';
import type { Action, ModalAction, ReplyAction } from './types.js';

/** Discord interaction types the runtime understands. */
export const INTERACTION_COMPONENT = 3;
export const INTERACTION_MODAL_SUBMIT = 5;

/** Discord callback types (interaction response). */
export const CALLBACK_CHANNEL_MESSAGE = 4;
export const CALLBACK_MODAL = 9;

/** The minimal Discord interaction shape the runtime needs to resolve. */
export interface InteractionPayload {
  readonly type?: number;
  readonly data?: { readonly custom_id?: string };
}

/** A type-4 callback: channel message with source. */
export interface ChannelMessageCallback {
  readonly type: 4;
  readonly data: {
    readonly content?: string;
    readonly embeds?: DiscordEmbed[];
    readonly flags?: number;
  };
}

/** A type-9 callback: modal response. */
export interface ModalCallback {
  readonly type: 9;
  readonly data: {
    readonly custom_id: string;
    readonly title: string;
    readonly components: Record<string, unknown>[];
  };
}

export type InteractionCallback = ChannelMessageCallback | ModalCallback;

export interface InteractionDispatch {
  readonly matched: boolean;
  readonly customId?: string;
  readonly callback?: InteractionCallback;
}

/** Discord flag marking a reply as ephemeral (visible only to the invoker). */
export const EPHEMERAL_FLAG = 64;

type ReplyFields = Pick<ReplyAction, 'content' | 'embeds' | 'ephemeral'>;

/** Builds the type-4 callback data for a reply action or a modal submit. */
const replyData = (action: ReplyFields): ChannelMessageCallback['data'] => {
  const data: { content?: string; embeds?: DiscordEmbed[]; flags?: number } = {};
  if (action.content !== undefined) data.content = action.content;
  if (action.embeds !== undefined) data.embeds = action.embeds.map(normalizeEmbed);
  if (action.ephemeral) data.flags = EPHEMERAL_FLAG;
  return data;
};

/** Builds the type-9 callback data that opens a modal for `action`. */
const modalData = (action: ModalAction): ModalCallback['data'] => ({
  custom_id: action.submitCustomId,
  title: action.title,
  components: [{ type: 1, components: normalizeTextInputs(action.inputs) }],
});

/**
 * Pure hook: resolves an interaction against a set of registered actions.
 *
 * This is the extension point the Gateway transport calls. A component click
 * (`type` 3) maps its `custom_id` to a registered reply or modal; a modal
 * submit (`type` 5) maps its `custom_id` to the submitting action's reply.
 */
export const resolveInteraction = (
  actions: ReadonlyMap<string, Action>,
  interaction: InteractionPayload,
): InteractionDispatch => {
  const customId = interaction.data?.custom_id;
  if (customId === undefined) return { matched: false };

  const type = interaction.type ?? INTERACTION_COMPONENT;

  if (type === INTERACTION_COMPONENT) {
    const action = actions.get(customId);
    if (!action) return { matched: false, customId };
    if (action.kind === 'modal') {
      return { matched: true, customId, callback: { type: CALLBACK_MODAL, data: modalData(action) } };
    }
    return { matched: true, customId, callback: { type: CALLBACK_CHANNEL_MESSAGE, data: replyData(action) } };
  }

  if (type === INTERACTION_MODAL_SUBMIT) {
    for (const action of actions.values()) {
      if (action.kind === 'modal' && action.submitCustomId === customId) {
        return {
          matched: true,
          customId,
          callback: { type: CALLBACK_CHANNEL_MESSAGE, data: replyData(action) },
        };
      }
    }
    return { matched: false, customId };
  }

  return { matched: false, customId };
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

import type { EmbedInput } from '../tools/embeds.js';

/** The part of an interaction payload that carries submitted values. */
interface ValueCarrier {
  readonly data?: {
    readonly values?: readonly string[];
    readonly components?: readonly {
      readonly components?: readonly { readonly custom_id?: string; readonly value?: string }[];
    }[];
  };
}

/** Extracts selected values from a component interaction, or an empty list. */
export const extractValues = (interaction: ValueCarrier): string[] =>
  interaction.data?.values ? [...interaction.data.values] : [];

/** Extracts modal input values keyed by custom_id, or an empty map. */
export const extractInputs = (interaction: ValueCarrier): Record<string, string> => {
  const inputs: Record<string, string> = {};
  for (const row of interaction.data?.components ?? []) {
    for (const component of row.components ?? []) {
      if (component.custom_id !== undefined && component.value !== undefined) {
        inputs[component.custom_id] = component.value;
      }
    }
  }
  return inputs;
};

/**
 * Replaces `{values}`, `{values.N}`, and `{input.<customId>}` placeholders in
 * a string, using the values selected in a menu or typed into a modal.
 */
export const substitutePlaceholders = (
  text: string,
  values: readonly string[],
  inputs: Readonly<Record<string, string>>,
): string =>
  text
    .replace(/\{values\.(\d+)\}/g, (_match, index: string) => values[Number(index)] ?? '')
    .replace(/\{values\}/g, () => values.join(', '))
    .replace(/\{input\.([\w-]+)\}/g, (_match, id: string) => inputs[id] ?? '');

/** Applies placeholder substitution to a reply's content and embed text. */
export const substituteReply = (
  action: { readonly content?: string; readonly embeds?: readonly EmbedInput[] },
  values: readonly string[],
  inputs: Readonly<Record<string, string>>,
): { content?: string; embeds?: EmbedInput[] } => {
  const substitute = (text: string): string => substitutePlaceholders(text, values, inputs);
  return {
    ...(action.content !== undefined ? { content: substitute(action.content) } : {}),
    ...(action.embeds !== undefined
      ? {
          embeds: action.embeds.map((embed) => ({
            ...embed,
            ...(embed.title !== undefined ? { title: substitute(embed.title) } : {}),
            ...(embed.description !== undefined
              ? { description: substitute(embed.description) }
              : {}),
            ...(embed.fields !== undefined
              ? {
                  fields: embed.fields.map((field) => ({
                    ...field,
                    name: substitute(field.name),
                    value: substitute(field.value),
                  })),
                }
              : {}),
          })),
        }
      : {}),
  };
};

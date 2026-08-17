import { z } from 'zod';
import { CHANNEL_TYPE_CODES, type ChannelType } from './channel-types.js';
import { normalizeColor } from './embeds.js';
import { snowflake } from './schemas.js';

/** Discord button style numeric codes, keyed by friendly name. */
export const BUTTON_STYLES = {
  primary: 1,
  secondary: 2,
  success: 3,
  danger: 4,
  link: 5,
} as const;

export type ButtonStyle = keyof typeof BUTTON_STYLES;

const buttonStyleSchema = z.enum(['primary', 'secondary', 'success', 'danger', 'link']);

const emojiSchema = z.object({
  name: z.string().min(1).max(64).optional().describe('Unicode emoji character (default emojis).'),
  id: snowflake.optional().describe('Custom emoji ID (custom emojis).'),
  animated: z.boolean().optional().describe('Whether a custom emoji is animated.'),
});

const buttonSchema = z.object({
  type: z.literal('button'),
  style: buttonStyleSchema.describe('Button style.'),
  label: z.string().min(1).max(80).optional().describe('Button label (1-80 characters).'),
  customId: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe('Developer-defined identifier, used by the future interaction runtime.'),
  url: z.string().url().optional().describe('URL to open (link buttons only).'),
  emoji: emojiSchema.optional(),
  disabled: z.boolean().optional().describe('Whether the button is greyed out.'),
});

const selectOptionSchema = z.object({
  label: z.string().min(1).max(100).describe('Option label (1-100).'),
  value: z.string().min(1).max(100).describe('Option value (1-100).'),
  description: z.string().min(1).max(100).optional().describe('Optional option description.'),
  emoji: emojiSchema.optional(),
  default: z.boolean().optional().describe('Whether this option is selected by default.'),
});

const selectBase = {
  customId: z.string().min(1).max(100).describe('Developer-defined identifier for this menu.'),
  placeholder: z.string().min(1).max(150).optional().describe('Placeholder shown when nothing is selected.'),
  minValues: z.number().int().min(0).max(25).optional().describe('Minimum number of selections.'),
  maxValues: z.number().int().min(1).max(25).optional().describe('Maximum number of selections.'),
  disabled: z.boolean().optional().describe('Whether the menu is greyed out.'),
} as const;

const stringSelectSchema = z.object({
  type: z.literal('stringSelect'),
  ...selectBase,
  options: z.array(selectOptionSchema).min(1).max(25).describe('Up to 25 selectable options.'),
});

const userSelectSchema = z.object({
  type: z.literal('userSelect'),
  ...selectBase,
});

const roleSelectSchema = z.object({
  type: z.literal('roleSelect'),
  ...selectBase,
});

const mentionableSelectSchema = z.object({
  type: z.literal('mentionableSelect'),
  ...selectBase,
});

const channelTypeSchema = z.enum(
  Object.keys(CHANNEL_TYPE_CODES) as [ChannelType, ...ChannelType[]],
);

const channelSelectSchema = z.object({
  type: z.literal('channelSelect'),
  ...selectBase,
  channelTypes: z
    .array(channelTypeSchema)
    .optional()
    .describe('Channel types the menu allows (defaults to all).'),
});

export const interactiveComponentSchema = z
  .discriminatedUnion('type', [
    buttonSchema,
    stringSelectSchema,
    userSelectSchema,
    roleSelectSchema,
    mentionableSelectSchema,
    channelSelectSchema,
  ])
  .superRefine((component, ctx) => {
    if (component.type === 'button') {
      if (component.style === 'link' && !component.url) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Link buttons require a "url".' });
      }
      if (component.style !== 'link' && !component.customId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Non-link buttons require a "customId".' });
      }
    }
  });

export const actionRowSchema = z.object({
  type: z.literal('actionRow'),
  components: z.array(interactiveComponentSchema).min(1).max(5).describe('1-5 buttons or select menus.'),
});

/* -------------------------------------------------------------------------- */
/* Components V2 layout                                                       */
/* -------------------------------------------------------------------------- */

/** Markdown text block (Components V2, type 10). */
export const textDisplaySchema = z.object({
  type: z.literal('textDisplay'),
  content: z
    .string()
    .min(1)
    .max(4000)
    .describe('Markdown text to display (up to 4000 characters).'),
});

/** Vertical spacing between components (Components V2, type 14). */
export const separatorSchema = z.object({
  type: z.literal('separator'),
  spacing: z
    .enum(['small', 'large'])
    .optional()
    .describe('Vertical spacing: small or large.'),
  divider: z.boolean().optional().describe('Whether to draw a visible divider line.'),
});

/** A media item inside a media gallery. */
const mediaItemSchema = z.object({
  media: z.object({ url: z.string().url().describe('URL of the image or video.') }),
  description: z.string().max(1024).optional().describe('Alt text or caption.'),
  spoiler: z.boolean().optional().describe('Whether the media is spoiler-tagged.'),
});

/** A grid of images or videos (Components V2, type 12). */
export const mediaGallerySchema = z.object({
  type: z.literal('mediaGallery'),
  items: z.array(mediaItemSchema).min(1).max(10).describe('Up to 10 media items.'),
});

/** A single attached-file display (Components V2, type 13). */
export const fileComponentSchema = z.object({
  type: z.literal('file'),
  file: z
    .object({ url: z.string().describe('Attachment URL (attachment://...).') })
    .describe('The file to display.'),
  spoiler: z.boolean().optional().describe('Whether the file is spoiler-tagged.'),
});

/** A small image used as a section accessory (Components V2, type 11). */
export const thumbnailSchema = z.object({
  type: z.literal('thumbnail'),
  media: z.object({ url: z.string().url().describe('URL of the image.') }),
  description: z.string().max(1024).optional().describe('Alt text (up to 1024 characters).'),
});

/** Text on the left with a thumbnail or button accessory (Components V2, type 9). */
export const sectionSchema = z.object({
  type: z.literal('section'),
  components: z.array(textDisplaySchema).min(1).max(3).describe('1-3 text display blocks.'),
  accessory: z
    .discriminatedUnion('type', [thumbnailSchema, buttonSchema])
    .optional()
    .describe('A thumbnail or button shown on the right.'),
});

/** A styled wrapper grouping child components (Components V2, type 17). */
export const containerSchema = z.object({
  type: z.literal('container'),
  accentColor: z
    .union([
      z.number().int().min(0).max(0xffffff),
      z.string().regex(/^#?[0-9a-fA-F]{6}$/, 'hex color like #FFAA00'),
    ])
    .optional()
    .describe('Accent color shown as a side bar (embed-style).'),
  spoiler: z.boolean().optional().describe('Whether the container content is spoiler-tagged.'),
  components: z
    .array(
      z.discriminatedUnion('type', [
        actionRowSchema,
        textDisplaySchema,
        separatorSchema,
        sectionSchema,
        mediaGallerySchema,
        fileComponentSchema,
      ]),
    )
    .min(1)
    .max(10)
    .describe('1-10 child components.'),
});

/** A top-level message component (V1 action rows or V2 layout components). */
export const topLevelComponentSchema = z.discriminatedUnion('type', [
  actionRowSchema,
  containerSchema,
  textDisplaySchema,
  separatorSchema,
  mediaGallerySchema,
  sectionSchema,
  fileComponentSchema,
]);

/** Component types that only exist in Components V2. */
const V2_LAYOUT_TYPES = new Set([
  'container',
  'section',
  'textDisplay',
  'separator',
  'mediaGallery',
  'thumbnail',
  'file',
]);

/** Message flag marking a message as Components V2 (1 << 15). */
export const COMPONENTS_V2_FLAG = 1 << 15;

/** Whether any component in the list requires Components V2 rendering. */
export const isComponentsV2 = (components: readonly { readonly type: string }[]): boolean =>
  components.some((component) => V2_LAYOUT_TYPES.has(component.type));

/** A message's components: V1 action rows or V2 layout components. */
export const componentsSchema = z
  .array(topLevelComponentSchema)
  .min(1)
  .max(40)
  .describe('Up to 40 components (V1 action rows or V2 layout components).')
  .superRefine((components, ctx) => {
    const v2 = components.some((component) => V2_LAYOUT_TYPES.has(component.type));
    if (!v2 && components.length > 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'V1 messages allow at most 5 action rows; use Components V2 for more.',
      });
    }
  });

/** Discord text-input style numeric codes, keyed by friendly name. */
export const TEXT_INPUT_STYLES = {
  short: 1,
  paragraph: 2,
} as const;

export type TextInputStyle = keyof typeof TEXT_INPUT_STYLES;

const textInputStyleSchema = z.enum(['short', 'paragraph']);

/** A single text input in a modal (Discord component type 4). */
export const textInputSchema = z
  .object({
    customId: z.string().min(1).max(100).describe('Identifier for this input (1-100 characters).'),
    label: z.string().min(1).max(45).describe('Input label (1-45 characters).'),
    style: textInputStyleSchema.describe('Single-line or multiline input.'),
    required: z.boolean().optional().describe('Whether the input must be filled in.'),
    placeholder: z.string().min(1).max(100).optional().describe('Placeholder text (1-100 characters).'),
    minLength: z.number().int().min(0).max(4000).optional().describe('Minimum input length.'),
    maxLength: z.number().int().min(1).max(4000).optional().describe('Maximum input length.'),
  })
  .superRefine((input, ctx) => {
    if (
      input.minLength !== undefined &&
      input.maxLength !== undefined &&
      input.minLength > input.maxLength
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: '"minLength" must not exceed "maxLength".' });
    }
  });

/** A modal's inputs: up to 5 text inputs. */
export const textInputsSchema = z.array(textInputSchema).min(1).max(5).describe('1-5 text inputs.');

export type EmojiInput = z.infer<typeof emojiSchema>;
export type ButtonInput = z.infer<typeof buttonSchema>;
export type TextInputInput = z.infer<typeof textInputSchema>;
export type SelectOptionInput = z.infer<typeof selectOptionSchema>;
export type InteractiveComponentInput = z.infer<typeof interactiveComponentSchema>;
export type ActionRowInput = z.infer<typeof actionRowSchema>;
export type TextDisplayInput = z.infer<typeof textDisplaySchema>;
export type SeparatorInput = z.infer<typeof separatorSchema>;
export type MediaGalleryInput = z.infer<typeof mediaGallerySchema>;
export type FileComponentInput = z.infer<typeof fileComponentSchema>;
export type ThumbnailInput = z.infer<typeof thumbnailSchema>;
export type SectionInput = z.infer<typeof sectionSchema>;
export type ContainerInput = z.infer<typeof containerSchema>;
export type TopLevelComponentInput = z.infer<typeof topLevelComponentSchema>;
export type ComponentsInput = z.infer<typeof componentsSchema>;

const normalizeEmoji = (emoji: EmojiInput): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  if (emoji.name !== undefined) result.name = emoji.name;
  if (emoji.id !== undefined) result.id = emoji.id;
  if (emoji.animated !== undefined) result.animated = emoji.animated;
  return result;
};

const normalizeSelectBase = (
  select: { customId: string; placeholder?: string; minValues?: number; maxValues?: number; disabled?: boolean },
): Record<string, unknown> => ({
  custom_id: select.customId,
  placeholder: select.placeholder,
  min_values: select.minValues,
  max_values: select.maxValues,
  disabled: select.disabled,
});

const normalizeInteractiveComponent = (component: InteractiveComponentInput): Record<string, unknown> => {
  switch (component.type) {
    case 'button':
      return {
        type: 2,
        style: BUTTON_STYLES[component.style],
        label: component.label,
        custom_id: component.customId,
        url: component.url,
        emoji: component.emoji ? normalizeEmoji(component.emoji) : undefined,
        disabled: component.disabled,
      };
    case 'stringSelect':
      return {
        type: 3,
        ...normalizeSelectBase(component),
        options: component.options.map((option) => ({
          label: option.label,
          value: option.value,
          description: option.description,
          emoji: option.emoji ? normalizeEmoji(option.emoji) : undefined,
          default: option.default,
        })),
      };
    case 'userSelect':
      return { type: 5, ...normalizeSelectBase(component) };
    case 'roleSelect':
      return { type: 6, ...normalizeSelectBase(component) };
    case 'mentionableSelect':
      return { type: 7, ...normalizeSelectBase(component) };
    case 'channelSelect':
      return {
        type: 8,
        ...normalizeSelectBase(component),
        channel_types: component.channelTypes?.map((type) => CHANNEL_TYPE_CODES[type]),
      };
    default: {
      throw new Error(`Unsupported component type: ${(component as { type: string }).type}`);
    }
  }
};

/** Normalizes a section accessory (thumbnail or button) to numeric JSON. */
const normalizeAccessory = (accessory: ThumbnailInput | ButtonInput): Record<string, unknown> => {
  if (accessory.type === 'thumbnail') {
    return { type: 11, media: { url: accessory.media.url }, description: accessory.description };
  }
  return normalizeInteractiveComponent(accessory);
};

/** Normalizes a single component (V1 or V2) to Discord's numeric JSON. */
const normalizeComponent = (component: TopLevelComponentInput): Record<string, unknown> => {
  switch (component.type) {
    case 'actionRow':
      return { type: 1, components: component.components.map(normalizeInteractiveComponent) };
    case 'container':
      return {
        type: 17,
        accent_color:
          component.accentColor !== undefined ? normalizeColor(component.accentColor) : undefined,
        spoiler: component.spoiler,
        components: component.components.map(normalizeComponent),
      };
    case 'section':
      return {
        type: 9,
        components: component.components.map(normalizeComponent),
        accessory: component.accessory ? normalizeAccessory(component.accessory) : undefined,
      };
    case 'textDisplay':
      return { type: 10, content: component.content };
    case 'separator':
      return { type: 14, spacing: component.spacing === 'large' ? 2 : 1, divider: component.divider };
    case 'mediaGallery':
      return {
        type: 12,
        items: component.items.map((item) => ({
          media: { url: item.media.url },
          description: item.description,
          spoiler: item.spoiler,
        })),
      };
    case 'file':
      return { type: 13, file: { url: component.file.url }, spoiler: component.spoiler };
    default: {
      const never: never = component;
      throw new Error(`Unsupported component type: ${never}`);
    }
  }
};

/** Converts friendly component input to Discord's exact numeric JSON (V1 or V2). */
export const normalizeComponents = (components: readonly TopLevelComponentInput[]): Record<string, unknown>[] =>
  components.map(normalizeComponent);

/** Converts a friendly text input to Discord's numeric component JSON (type 4). */
export const normalizeTextInput = (input: TextInputInput): Record<string, unknown> => ({
  type: 4,
  custom_id: input.customId,
  label: input.label,
  style: TEXT_INPUT_STYLES[input.style],
  required: input.required,
  placeholder: input.placeholder,
  min_length: input.minLength,
  max_length: input.maxLength,
});

export const normalizeTextInputs = (inputs: readonly TextInputInput[]): Record<string, unknown>[] =>
  inputs.map(normalizeTextInput);

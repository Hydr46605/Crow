import { z } from 'zod';
import { textInputsSchema } from '../tools/components.js';
import { embedSchema } from '../tools/embeds.js';

/**
 * A reply action: replies with content/embeds when a component with `customId`
 * is used. Embeds reuse the shared embed schema.
 */
export const replyActionSchema = z.object({
  kind: z.literal('reply'),
  customId: z
    .string()
    .min(1)
    .max(100)
    .describe('The component custom_id this action responds to (1-100 characters).'),
  content: z.string().min(1).max(2000).optional().describe('Reply message content (1-2000 characters).'),
  embeds: z.array(embedSchema).min(1).max(10).optional().describe('Up to 10 reply embeds.'),
  ephemeral: z.boolean().optional().describe('Whether the reply is only visible to the user.'),
});

/**
 * A modal action: opens a modal when a component with `customId` is used, then
 * replies when that modal is submitted. Embeds reuse the shared embed schema.
 */
export const modalActionSchema = z.object({
  kind: z.literal('modal'),
  customId: z
    .string()
    .min(1)
    .max(100)
    .describe('The component custom_id that opens this modal (1-100 characters).'),
  title: z.string().min(1).max(45).describe('Modal title (1-45 characters).'),
  inputs: textInputsSchema.describe('1-5 text inputs shown in the modal.'),
  submitCustomId: z
    .string()
    .min(1)
    .max(100)
    .describe('The modal custom_id used when it is submitted (1-100 characters).'),
  content: z.string().min(1).max(2000).optional().describe('Reply content on submit (1-2000 characters).'),
  embeds: z.array(embedSchema).min(1).max(10).optional().describe('Up to 10 reply embeds on submit.'),
  ephemeral: z.boolean().optional().describe('Whether the reply is only visible to the user.'),
});

export type ReplyAction = z.infer<typeof replyActionSchema>;
export type ModalAction = z.infer<typeof modalActionSchema>;
export type Action = ReplyAction | ModalAction;

const actionUnionSchema = z
  .discriminatedUnion('kind', [replyActionSchema, modalActionSchema])
  .superRefine((action, ctx) => {
    if (!action.content && !action.embeds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide "content", "embeds", or both.',
      });
    }
  });

/**
 * Action schema used for tool input and the persisted registry.
 *
 * Legacy entries written without a `kind` are treated as `reply` actions, so
 * existing registries keep working after the modal-action upgrade.
 */
export const actionSchema = z.preprocess(
  (value) => {
    if (typeof value === 'object' && value !== null && !('kind' in value)) {
      return { kind: 'reply', ...(value as Record<string, unknown>) };
    }
    return value;
  },
  actionUnionSchema,
);

/** A logged component/modal interaction, with the values the user submitted. */
export const interactionRecordSchema = z.object({
  id: z.string().min(1),
  customId: z.string().min(1),
  type: z.number().int(),
  values: z.array(z.string()),
  inputs: z.record(z.string(), z.string()),
  userId: z.string().optional(),
  channelId: z.string().optional(),
  timestamp: z.string().min(1),
});

export type InteractionRecord = z.infer<typeof interactionRecordSchema>;

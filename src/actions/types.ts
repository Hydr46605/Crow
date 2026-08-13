import { z } from 'zod';
import { embedSchema } from '../tools/embeds.js';

/**
 * A registered action: the reply Crow sends when a component with `customId`
 * is used. Embeds reuse the shared embed schema.
 */
export const actionSchema = z
  .object({
    customId: z
      .string()
      .min(1)
      .max(100)
      .describe('The component custom_id this action responds to (1-100 characters).'),
    content: z.string().min(1).max(2000).optional().describe('Reply message content (1-2000 characters).'),
    embeds: z.array(embedSchema).min(1).max(10).optional().describe('Up to 10 reply embeds.'),
    ephemeral: z.boolean().optional().describe('Whether the reply is only visible to the user.'),
  })
  .superRefine((action, ctx) => {
    if (!action.content && !action.embeds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide "content", "embeds", or both.',
      });
    }
  });

export type Action = z.infer<typeof actionSchema>;

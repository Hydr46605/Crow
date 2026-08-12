import { z } from 'zod';
import { SNOWFLAKE_PATTERN } from '../discord/snowflake.js';

/** Zod schema for a Discord snowflake ID. */
export const snowflake = z
  .string()
  .regex(SNOWFLAKE_PATTERN, 'Discord snowflake ID (17-20 digits)')
  .describe('A Discord snowflake ID (17-20 digit number).');

/** Explicit consent flag required by destructive tools. */
export const consent = z
  .literal(true)
  .optional()
  .describe('Set to true to confirm this destructive action.');

export const channelType = z
  .enum(['text', 'voice', 'category', 'announcement', 'stageVoice', 'forum'])
  .describe('The type of channel to create.');

/** Allowed-mentions policy, shared by messaging and webhook tools. */
export const allowedMentionsSchema = z
  .object({
    parse: z
      .array(z.enum(['roles', 'users', 'everyone']))
      .optional()
      .describe('Mention types to parse (roles, users, everyone).'),
    roles: z.array(snowflake).optional().describe('Role IDs to allow mentions for.'),
    users: z.array(snowflake).optional().describe('User IDs to allow mentions for.'),
    repliedUser: z.boolean().optional().describe('Whether to mention the replied-to user.'),
  })
  .optional();

export type AllowedMentionsInput = z.infer<typeof allowedMentionsSchema>;

/** Maps a friendly allowed-mentions policy to Discord's snake_case JSON. */
export const normalizeAllowedMentions = (
  mentions: NonNullable<AllowedMentionsInput>,
): Record<string, unknown> => ({
  parse: mentions.parse,
  roles: mentions.roles,
  users: mentions.users,
  replied_user: mentions.repliedUser,
});

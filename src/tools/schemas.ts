import { z } from 'zod';
import { SNOWFLAKE_PATTERN } from '../discord/snowflake.js';

/** Zod schema for a Discord snowflake ID. */
export const snowflake = z
  .string()
  .regex(SNOWFLAKE_PATTERN, 'Discord snowflake ID (17-20 digits)');

/** Explicit consent flag required by destructive tools. */
export const consent = z.literal(true).optional();

export const channelType = z.enum(['text', 'voice', 'category', 'announcement', 'forum']);

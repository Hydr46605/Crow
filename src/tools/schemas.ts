import { z } from 'zod';
import { SNOWFLAKE_PATTERN } from '../discord/snowflake.js';

/** Zod schema for a Discord snowflake ID. */
export const snowflake = z
  .string()
  .regex(SNOWFLAKE_PATTERN, 'Discord snowflake ID (17-20 digits)');

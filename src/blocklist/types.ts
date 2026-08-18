import { z } from 'zod';
import { snowflake } from '../tools/schemas.js';

/** Categories a blocklist rule can target. They map onto tool annotations. */
export const BLOCKLIST_CATEGORIES = ['destructive', 'write', 'open_world'] as const;

export const blocklistCategorySchema = z.enum(BLOCKLIST_CATEGORIES);

export type BlocklistCategory = z.infer<typeof blocklistCategorySchema>;

/** A raw REST route rule: an HTTP method plus a segment glob. */
export const routeRuleSchema = z.object({
  method: z
    .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', '*'])
    .describe('HTTP method to block, or "*" for any method.'),
  pattern: z
    .string()
    .min(1)
    .max(1024)
    .describe('Route glob, e.g. "/channels/*/messages/*". "*" matches one segment, "**" any.'),
});

export type RouteRule = z.infer<typeof routeRuleSchema>;

/** The full blocklist: any matching rule blocks a tool call. */
export const blocklistSchema = z.object({
  tools: z.array(z.string().min(1)).default([]).describe('Tool names to block.'),
  categories: z
    .array(blocklistCategorySchema)
    .default([])
    .describe('Tool categories to block: destructive, write, or open_world.'),
  routes: z.array(routeRuleSchema).default([]).describe('Raw REST routes to block (discord_request).'),
  guilds: z.array(snowflake).default([]).describe('Guild IDs to block all access to.'),
});

export type Blocklist = z.infer<typeof blocklistSchema>;

/** A blocklist with no rules. */
export const emptyBlocklist = (): Blocklist => ({ tools: [], categories: [], routes: [], guilds: [] });

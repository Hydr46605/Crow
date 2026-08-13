import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { fileSourceSchema, MAX_EMOJI_BYTES, resolveFile, toDataUri } from '../files.js';
import { DESTRUCTIVE, IDEMPOTENT, READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { requireConsent } from './consent.js';
import { errorResult, textResult } from './result.js';
import { consent, snowflake } from './schemas.js';

const emojiNameSchema = z
  .string()
  .min(2)
  .max(32)
  .regex(/^[a-zA-Z0-9_]+$/, 'alphanumeric characters and underscores')
  .describe('Emoji name (2-32 alphanumeric characters or underscores).');

const emojiImageSchema = z.union([
  z
    .string()
    .regex(
      /^data:image\/(?:png|jpe?g|gif);base64,[A-Za-z0-9+/=]+$/i,
      'a data URI like data:image/png;base64,...',
    )
    .describe('Emoji image as a data URI.'),
  fileSourceSchema,
]);

const createEmojiInput = {
  guildId: snowflake.describe('The ID of the guild to create the emoji in.'),
  name: emojiNameSchema,
  image: emojiImageSchema.describe('Emoji image: a data URI, or a file source (path/url/data).'),
  roles: z.array(snowflake).optional().describe('Role IDs allowed to use the emoji (empty for everyone).'),
  reason: z.string().max(512).optional().describe('Audit-log reason for creating the emoji.'),
};

export interface CreateEmojiArgs {
  readonly guildId: string;
  readonly name: string;
  readonly image: string | { readonly name?: string; readonly path?: string; readonly url?: string; readonly data?: string };
  readonly roles?: string[];
  readonly reason?: string;
}

interface RawEmoji {
  readonly id: string;
  readonly name: string;
  readonly roles?: string[];
  readonly animated?: boolean;
  readonly available?: boolean;
  readonly managed?: boolean;
  readonly require_colons?: boolean;
}

export interface EmojiSummary {
  readonly id: string;
  readonly name: string;
  readonly animated: boolean;
  readonly available: boolean;
  readonly managed: boolean;
  readonly requireColons: boolean;
  readonly roles: string[];
}

export const summarizeEmoji = (emoji: RawEmoji): EmojiSummary => ({
  id: emoji.id,
  name: emoji.name,
  animated: emoji.animated ?? false,
  available: emoji.available ?? true,
  managed: emoji.managed ?? false,
  requireColons: emoji.require_colons ?? true,
  roles: emoji.roles ?? [],
});

export const listEmojis = async (
  args: { readonly guildId: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('list_emojis', () =>
    ctx.discord.request<RawEmoji[]>('GET', `/guilds/${args.guildId}/emojis`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.map(summarizeEmoji), null, 2));
};

export const getEmoji = async (
  args: { readonly guildId: string; readonly emojiId: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('get_emoji', () =>
    ctx.discord.request<RawEmoji>('GET', `/guilds/${args.guildId}/emojis/${args.emojiId}`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeEmoji(result.value), null, 2));
};

export const createEmoji = async (
  args: CreateEmojiArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  let image: string;
  if (typeof args.image === 'string') {
    image = args.image;
  } else {
    const file = await resolveFile(args.image, MAX_EMOJI_BYTES);
    image = toDataUri(file);
  }

  const result = await attempt('create_emoji', () =>
    ctx.discord.request<RawEmoji>('POST', `/guilds/${args.guildId}/emojis`, {
      body: { name: args.name, image, roles: args.roles },
      reason: args.reason,
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeEmoji(result.value), null, 2));
};

export const modifyEmoji = async (
  args: { readonly guildId: string; readonly emojiId: string; readonly name?: string; readonly roles?: string[]; readonly reason?: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = {};
  if (args.name !== undefined) body.name = args.name;
  if (args.roles !== undefined) body.roles = args.roles;

  const result = await attempt('modify_emoji', () =>
    ctx.discord.request<RawEmoji>('PATCH', `/guilds/${args.guildId}/emojis/${args.emojiId}`, {
      body,
      reason: args.reason,
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeEmoji(result.value), null, 2));
};

export const deleteEmoji = async (
  args: { readonly guildId: string; readonly emojiId: string; readonly confirm?: true; readonly reason?: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const gate = requireConsent(args.confirm);
  if (gate) return gate;

  const result = await attempt('delete_emoji', () =>
    ctx.discord.request<unknown>('DELETE', `/guilds/${args.guildId}/emojis/${args.emojiId}`, {
      reason: args.reason,
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Deleted emoji ${args.emojiId}.`);
};

export const registerEmojiTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'list_emojis',
    {
      title: 'List emojis',
      description: 'List the custom emojis in a guild.',
      inputSchema: { guildId: snowflake.describe('The ID of the guild whose emojis to list.') },
      annotations: READ_ONLY,
    },
    async (args) => listEmojis(args, ctx),
  );
  server.registerTool(
    'get_emoji',
    {
      title: 'Get emoji',
      description: 'Get a single custom emoji by ID.',
      inputSchema: {
        guildId: snowflake.describe('The ID of the guild.'),
        emojiId: snowflake.describe('The ID of the emoji.'),
      },
      annotations: READ_ONLY,
    },
    async (args) => getEmoji(args, ctx),
  );
  server.registerTool(
    'create_emoji',
    {
      title: 'Create emoji',
      description:
        'Create a custom emoji from a data URI or a local file/URL (PNG, JPEG, or GIF, up to 256 KB).',
      inputSchema: createEmojiInput,
    },
    async (args) => createEmoji(args, ctx),
  );
  server.registerTool(
    'modify_emoji',
    {
      title: 'Modify emoji',
      description: 'Rename an emoji and/or change which roles can use it.',
      inputSchema: {
        guildId: snowflake.describe('The ID of the guild.'),
        emojiId: snowflake.describe('The ID of the emoji.'),
        name: emojiNameSchema.optional(),
        roles: z.array(snowflake).optional().describe('Role IDs allowed to use the emoji.'),
        reason: z.string().max(512).optional().describe('Audit-log reason.'),
      },
      annotations: IDEMPOTENT,
    },
    async (args) => modifyEmoji(args, ctx),
  );
  server.registerTool(
    'delete_emoji',
    {
      title: 'Delete emoji',
      description: 'Delete a custom emoji. Requires explicit consent ("confirm": true).',
      inputSchema: {
        guildId: snowflake.describe('The ID of the guild.'),
        emojiId: snowflake.describe('The ID of the emoji.'),
        confirm: consent,
        reason: z.string().max(512).optional().describe('Audit-log reason.'),
      },
      annotations: DESTRUCTIVE,
    },
    async (args) => deleteEmoji(args, ctx),
  );
};

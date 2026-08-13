import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { fileSourceSchema, MAX_STICKER_BYTES, resolveFile } from '../files.js';
import { DESTRUCTIVE, IDEMPOTENT, READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { requireConsent } from './consent.js';
import { errorResult, textResult } from './result.js';
import { consent, snowflake } from './schemas.js';

const stickerNameSchema = z
  .string()
  .min(2)
  .max(30)
  .describe('Sticker name (2-30 characters).');

const stickerDescriptionSchema = z
  .string()
  .max(100)
  .optional()
  .describe('Sticker description (up to 100 characters).');

const stickerTagsSchema = z
  .string()
  .min(1)
  .max(200)
  .describe('Comma-separated emoji/word tags (up to 200 characters).');

const createStickerInput = {
  guildId: snowflake.describe('The ID of the guild to create the sticker in.'),
  name: stickerNameSchema,
  description: stickerDescriptionSchema,
  tags: stickerTagsSchema,
  file: fileSourceSchema.describe('The sticker file (PNG, APNG, or Lottie JSON, up to 512 KB).'),
  reason: z.string().max(512).optional().describe('Audit-log reason for creating the sticker.'),
};

export type CreateStickerArgs = z.infer<z.ZodObject<typeof createStickerInput>>;

interface RawSticker {
  readonly id: string;
  readonly name: string;
  readonly description?: string | null;
  readonly tags: string;
  readonly type: number;
  readonly format_type: number;
  readonly available?: boolean;
  readonly guild_id?: string;
}

export interface StickerSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly tags: string;
  readonly type: string;
  readonly formatType: string;
  readonly available: boolean;
  readonly guildId?: string;
}

const STICKER_TYPES: Readonly<Record<number, string>> = { 1: 'standard', 2: 'guild' };
const STICKER_FORMATS: Readonly<Record<number, string>> = { 1: 'png', 2: 'apng', 3: 'lottie' };

export const summarizeSticker = (sticker: RawSticker): StickerSummary => ({
  id: sticker.id,
  name: sticker.name,
  description: sticker.description ?? null,
  tags: sticker.tags,
  type: STICKER_TYPES[sticker.type] ?? String(sticker.type),
  formatType: STICKER_FORMATS[sticker.format_type] ?? String(sticker.format_type),
  available: sticker.available ?? true,
  guildId: sticker.guild_id,
});

interface RawStickerPack {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly stickers: RawSticker[];
  readonly cover_sticker_id?: string;
}

export const summarizeStickerPack = (pack: RawStickerPack): Record<string, unknown> => ({
  id: pack.id,
  name: pack.name,
  description: pack.description,
  coverStickerId: pack.cover_sticker_id,
  stickers: pack.stickers.map(summarizeSticker),
});

export const listStickers = async (
  args: { readonly guildId: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('list_stickers', () =>
    ctx.discord.request<RawSticker[]>('GET', `/guilds/${args.guildId}/stickers`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.map(summarizeSticker), null, 2));
};

export const getSticker = async (
  args: { readonly guildId: string; readonly stickerId: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('get_sticker', () =>
    ctx.discord.request<RawSticker>('GET', `/guilds/${args.guildId}/stickers/${args.stickerId}`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeSticker(result.value), null, 2));
};

export const listStickerPacks = async (ctx: CrowContext): Promise<CallToolResult> => {
  const result = await attempt('list_sticker_packs', () =>
    ctx.discord.request<{ sticker_packs: RawStickerPack[] }>('GET', '/sticker-packs'),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.sticker_packs.map(summarizeStickerPack), null, 2));
};

export const getStickerPack = async (
  args: { readonly packId: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('get_sticker_pack', () =>
    ctx.discord.request<{ sticker_pack: RawStickerPack }>('GET', `/sticker-packs/${args.packId}`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeStickerPack(result.value.sticker_pack), null, 2));
};

export const createSticker = async (
  args: CreateStickerArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const file = await resolveFile(args.file, MAX_STICKER_BYTES);

  const result = await attempt('create_sticker', () =>
    ctx.discord.request<RawSticker>('POST', `/guilds/${args.guildId}/stickers`, {
      body: { name: args.name, description: args.description, tags: args.tags },
      files: [{ name: file.name, data: file.data, contentType: file.contentType, key: 'file' }],
      appendToFormData: true,
      reason: args.reason,
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeSticker(result.value), null, 2));
};

export const modifySticker = async (
  args: {
    readonly guildId: string;
    readonly stickerId: string;
    readonly name?: string;
    readonly description?: string;
    readonly tags?: string;
    readonly reason?: string;
  },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = {};
  if (args.name !== undefined) body.name = args.name;
  if (args.description !== undefined) body.description = args.description;
  if (args.tags !== undefined) body.tags = args.tags;

  const result = await attempt('modify_sticker', () =>
    ctx.discord.request<RawSticker>('PATCH', `/guilds/${args.guildId}/stickers/${args.stickerId}`, {
      body,
      reason: args.reason,
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeSticker(result.value), null, 2));
};

export const deleteSticker = async (
  args: { readonly guildId: string; readonly stickerId: string; readonly confirm?: true; readonly reason?: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const gate = requireConsent(args.confirm);
  if (gate) return gate;

  const result = await attempt('delete_sticker', () =>
    ctx.discord.request<unknown>('DELETE', `/guilds/${args.guildId}/stickers/${args.stickerId}`, {
      reason: args.reason,
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Deleted sticker ${args.stickerId}.`);
};

export const registerStickerTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'list_stickers',
    {
      title: 'List stickers',
      description: 'List the custom stickers in a guild.',
      inputSchema: { guildId: snowflake.describe('The ID of the guild whose stickers to list.') },
      annotations: READ_ONLY,
    },
    async (args) => listStickers(args, ctx),
  );
  server.registerTool(
    'get_sticker',
    {
      title: 'Get sticker',
      description: 'Get a single guild sticker by ID.',
      inputSchema: {
        guildId: snowflake.describe('The ID of the guild.'),
        stickerId: snowflake.describe('The ID of the sticker.'),
      },
      annotations: READ_ONLY,
    },
    async (args) => getSticker(args, ctx),
  );
  server.registerTool(
    'list_sticker_packs',
    {
      title: 'List sticker packs',
      description: 'List the available (Nitro) sticker packs.',
      annotations: READ_ONLY,
    },
    async () => listStickerPacks(ctx),
  );
  server.registerTool(
    'get_sticker_pack',
    {
      title: 'Get sticker pack',
      description: 'Get a sticker pack by ID.',
      inputSchema: { packId: snowflake.describe('The ID of the sticker pack.') },
      annotations: READ_ONLY,
    },
    async (args) => getStickerPack(args, ctx),
  );
  server.registerTool(
    'create_sticker',
    {
      title: 'Create sticker',
      description:
        'Create a guild sticker from a local file/URL (PNG, APNG, or Lottie JSON, up to 512 KB).',
      inputSchema: createStickerInput,
    },
    async (args) => createSticker(args, ctx),
  );
  server.registerTool(
    'modify_sticker',
    {
      title: 'Modify sticker',
      description: 'Modify a guild sticker: name, description, and/or tags.',
      inputSchema: {
        guildId: snowflake.describe('The ID of the guild.'),
        stickerId: snowflake.describe('The ID of the sticker.'),
        name: stickerNameSchema.optional(),
        description: stickerDescriptionSchema,
        tags: stickerTagsSchema.optional(),
        reason: z.string().max(512).optional().describe('Audit-log reason.'),
      },
      annotations: IDEMPOTENT,
    },
    async (args) => modifySticker(args, ctx),
  );
  server.registerTool(
    'delete_sticker',
    {
      title: 'Delete sticker',
      description: 'Delete a guild sticker. Requires explicit consent ("confirm": true).',
      inputSchema: {
        guildId: snowflake.describe('The ID of the guild.'),
        stickerId: snowflake.describe('The ID of the sticker.'),
        confirm: consent,
        reason: z.string().max(512).optional().describe('Audit-log reason.'),
      },
      annotations: DESTRUCTIVE,
    },
    async (args) => deleteSticker(args, ctx),
  );
};

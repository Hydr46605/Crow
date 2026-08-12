import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { READ_ONLY } from './annotations.js';
import { textResult } from './result.js';

/** A color as a Discord integer (0-16777215) or a "#RRGGBB" hex string. */
const colorSchema = z
  .union([
    z.number().int().min(0).max(0xffffff),
    z.string().regex(/^#?[0-9a-fA-F]{6}$/, 'hex color like #FFAA00'),
  ])
  .describe('Embed color as an integer (0-16777215) or a "#RRGGBB" hex string.');

const embedFieldSchema = z.object({
  name: z.string().min(1).max(256).describe('Field name (1-256 characters).'),
  value: z.string().min(1).max(1024).describe('Field value (1-1024 characters).'),
  inline: z.boolean().optional().describe('Whether this field renders inline with others.'),
});

const embedAuthorSchema = z.object({
  name: z.string().min(1).max(256).describe('Author name (1-256 characters).'),
  url: z.string().url().optional().describe('URL the author name links to.'),
  iconUrl: z.string().url().optional().describe('Icon URL shown next to the author name.'),
});

const embedFooterSchema = z.object({
  text: z.string().min(1).max(2048).describe('Footer text (1-2048 characters).'),
  iconUrl: z.string().url().optional().describe('Icon URL shown next to the footer text.'),
});

const embedMediaSchema = z.object({
  url: z.string().url().describe('URL of the media asset.'),
});

/** Total text length across the embed, enforced against Discord's 6000-char cap. */
const embedTextLength = (embed: EmbedInput): number => {
  let length = (embed.title?.length ?? 0) + (embed.description?.length ?? 0);
  length += (embed.author?.name.length ?? 0) + (embed.footer?.text.length ?? 0);
  for (const field of embed.fields ?? []) length += field.name.length + field.value.length;
  return length;
};

/**
 * A single Discord embed, validated against Discord's documented limits.
 *
 * The shape is agent-friendly (camelCase, hex colors allowed); `normalizeEmbed`
 * converts it to the exact snake_case JSON Discord expects.
 */
export const embedSchema = z
  .object({
    title: z.string().min(1).max(256).optional().describe('Embed title (1-256 characters).'),
    description: z.string().min(1).max(4096).optional().describe('Embed description (1-4096 characters).'),
    url: z.string().url().optional().describe('URL the title links to when clicked.'),
    color: colorSchema.optional(),
    timestamp: z.string().datetime({ offset: true }).optional().describe('ISO-8601 timestamp shown on the embed.'),
    author: embedAuthorSchema.optional(),
    footer: embedFooterSchema.optional(),
    image: embedMediaSchema.optional(),
    thumbnail: embedMediaSchema.optional(),
    fields: z.array(embedFieldSchema).min(1).max(25).optional().describe('Up to 25 fields.'),
  })
  .superRefine((embed, ctx) => {
    const total = embedTextLength(embed);
    if (total > 6000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Embed text exceeds Discord's 6000-character limit (got ${total}).`,
      });
    }
  });

/** One or more embeds (Discord allows up to 10 per message). */
export const embedsSchema = z.array(embedSchema).min(1).max(10).describe('Up to 10 embeds.');

export interface EmbedFieldInput {
  readonly name: string;
  readonly value: string;
  readonly inline?: boolean;
}

export interface EmbedInput {
  readonly title?: string;
  readonly description?: string;
  readonly url?: string;
  readonly color?: number | string;
  readonly timestamp?: string;
  readonly author?: { readonly name: string; readonly url?: string; readonly iconUrl?: string };
  readonly footer?: { readonly text: string; readonly iconUrl?: string };
  readonly image?: { readonly url: string };
  readonly thumbnail?: { readonly url: string };
  readonly fields?: readonly EmbedFieldInput[];
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  author?: { name: string; url?: string; icon_url?: string };
  footer?: { text: string; icon_url?: string };
  image?: { url: string };
  thumbnail?: { url: string };
  fields?: { name: string; value: string; inline?: boolean }[];
}

export const normalizeColor = (color: number | string): number =>
  typeof color === 'number' ? color : parseInt(color.replace('#', ''), 16);

/** Converts a friendly embed to Discord's exact snake_case JSON. */
export const normalizeEmbed = (embed: EmbedInput): DiscordEmbed => {
  const result: DiscordEmbed = {};
  if (embed.title !== undefined) result.title = embed.title;
  if (embed.description !== undefined) result.description = embed.description;
  if (embed.url !== undefined) result.url = embed.url;
  if (embed.color !== undefined) result.color = normalizeColor(embed.color);
  if (embed.timestamp !== undefined) result.timestamp = embed.timestamp;
  if (embed.author) {
    result.author = { name: embed.author.name };
    if (embed.author.url !== undefined) result.author.url = embed.author.url;
    if (embed.author.iconUrl !== undefined) result.author.icon_url = embed.author.iconUrl;
  }
  if (embed.footer) {
    result.footer = { text: embed.footer.text };
    if (embed.footer.iconUrl !== undefined) result.footer.icon_url = embed.footer.iconUrl;
  }
  if (embed.image) result.image = { url: embed.image.url };
  if (embed.thumbnail) result.thumbnail = { url: embed.thumbnail.url };
  if (embed.fields) {
    result.fields = embed.fields.map((field) => ({
      name: field.name,
      value: field.value,
      inline: field.inline,
    }));
  }
  return result;
};

/** Normalizes a list of embeds (used by messaging and webhook tools). */
export const normalizeEmbeds = (embeds: readonly EmbedInput[]): DiscordEmbed[] =>
  embeds.map(normalizeEmbed);

const createEmbedInput = { embed: embedSchema };

/** Local, read-only helper: validates an embed and returns Discord's JSON for it. */
export const createEmbed = (args: { readonly embed: EmbedInput }): CallToolResult =>
  textResult(JSON.stringify(normalizeEmbed(args.embed), null, 2));

export const registerEmbedTools = (server: McpServer, _ctx: CrowContext): void => {
  server.registerTool(
    'create_embed',
    {
      title: 'Create embed',
      description:
        'Build a Discord rich embed object, validated against Discord limits. Returns the exact ' +
        'JSON to pass to send_message, edit_message, or execute_webhook as an embed.',
      inputSchema: createEmbedInput,
      annotations: READ_ONLY,
    },
    async (args) => createEmbed(args),
  );
};

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import {
  fileSourceSchema,
  MAX_AVATAR_BYTES,
  resolveFile,
  toDataUri,
  type FileSourceInput,
} from '../files.js';
import { IDEMPOTENT, READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { errorResult, textResult } from './result.js';
import { snowflake } from './schemas.js';

const usernameSchema = z
  .string()
  .min(2)
  .max(32)
  .describe('New username (2-32 characters).');

const profileImageSchema = z.union([
  z
    .string()
    .regex(
      /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/i,
      'a data URI like data:image/png;base64,...',
    )
    .describe('Image as a base64 data URI.'),
  fileSourceSchema,
]);

const modifyCurrentUserInput = z
  .object({
    username: usernameSchema.optional(),
    avatar: profileImageSchema.optional().describe('New avatar (data URI or file source).'),
    banner: profileImageSchema.optional().describe('New banner (data URI or file source).'),
    bio: z
      .string()
      .min(1)
      .max(190)
      .optional()
      .describe('New "About Me" bio (1-190 characters).'),
  })
  .superRefine((args, ctx) => {
    if (!args.username && !args.avatar && !args.banner && !args.bio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one of "username", "avatar", "banner", or "bio".',
      });
    }
  });

export type ModifyCurrentUserArgs = z.infer<typeof modifyCurrentUserInput>;

const modifyCurrentMemberInput = z
  .object({
    guildId: snowflake.describe('The ID of the guild.'),
    nick: z
      .string()
      .min(1)
      .max(32)
      .optional()
      .describe("The bot's new nickname in this guild (1-32 characters)."),
    avatar: profileImageSchema.optional().describe('New guild avatar (data URI or file source).'),
    banner: profileImageSchema.optional().describe('New guild banner (data URI or file source).'),
    bio: z
      .string()
      .min(1)
      .max(190)
      .optional()
      .describe('New guild "About Me" bio (1-190 characters).'),
  })
  .superRefine((args, ctx) => {
    if (!args.nick && !args.avatar && !args.banner && !args.bio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one of "nick", "avatar", "banner", or "bio".',
      });
    }
  });

export type ModifyCurrentMemberArgs = z.infer<typeof modifyCurrentMemberInput>;

interface RawCurrentUser {
  readonly id: string;
  readonly username: string;
  readonly global_name?: string | null;
  readonly avatar?: string | null;
  readonly banner?: string | null;
  readonly bio?: string | null;
  readonly accent_color?: number | null;
}

export interface CurrentUserSummary {
  readonly id: string;
  readonly username: string;
  readonly globalName: string | null;
  readonly avatar: string | null;
  readonly banner: string | null;
  readonly bio: string | null;
  readonly accentColor: number | null;
}

export const summarizeCurrentUser = (user: RawCurrentUser): CurrentUserSummary => ({
  id: user.id,
  username: user.username,
  globalName: user.global_name ?? null,
  avatar: user.avatar ?? null,
  banner: user.banner ?? null,
  bio: user.bio ?? null,
  accentColor: user.accent_color ?? null,
});

/** Resolves a data URI or file source to a base64 data URI for avatar/banner upload. */
const imageToDataUri = async (image: string | FileSourceInput): Promise<string> => {
  if (typeof image === 'string') return image;
  const file = await resolveFile(image, MAX_AVATAR_BYTES);
  return toDataUri(file);
};

export const getCurrentUser = async (ctx: CrowContext): Promise<CallToolResult> => {
  const result = await attempt('get_current_user', () =>
    ctx.discord.request<RawCurrentUser>('GET', '/users/@me'),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeCurrentUser(result.value), null, 2));
};

export const modifyCurrentUser = async (
  args: ModifyCurrentUserArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('modify_current_user', async () => {
    const body: Record<string, unknown> = {};
    if (args.username !== undefined) body.username = args.username;
    if (args.avatar !== undefined) body.avatar = await imageToDataUri(args.avatar);
    if (args.banner !== undefined) body.banner = await imageToDataUri(args.banner);
    if (args.bio !== undefined) body.bio = args.bio;

    return ctx.discord.request<RawCurrentUser>('PATCH', '/users/@me', { body });
  });
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeCurrentUser(result.value), null, 2));
};

export const modifyCurrentMember = async (
  args: ModifyCurrentMemberArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('modify_current_member', async () => {
    const body: Record<string, unknown> = {};
    if (args.nick !== undefined) body.nick = args.nick;
    if (args.avatar !== undefined) body.avatar = await imageToDataUri(args.avatar);
    if (args.banner !== undefined) body.banner = await imageToDataUri(args.banner);
    if (args.bio !== undefined) body.bio = args.bio;

    return ctx.discord.request<unknown>('PATCH', `/guilds/${args.guildId}/members/@me`, { body });
  });
  if (!result.ok) return errorResult(result.error);
  return textResult(`Updated the bot's member profile in guild ${args.guildId}.`);
};

export const registerProfileTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'get_current_user',
    {
      title: 'Get current user',
      description: "Get the bot's own user profile (username, avatar, banner, and bio).",
      annotations: READ_ONLY,
    },
    async () => getCurrentUser(ctx),
  );
  server.registerTool(
    'modify_current_user',
    {
      title: 'Modify current user',
      description:
        "Modify the bot's own profile: username, avatar, banner, and/or bio. Avatar and banner " +
        'accept a data URI or a file source (path/url/data).',
      inputSchema: modifyCurrentUserInput,
      annotations: IDEMPOTENT,
    },
    async (args) => modifyCurrentUser(args, ctx),
  );
  server.registerTool(
    'modify_current_member',
    {
      title: 'Modify current member',
      description:
        "Modify the bot's own member profile in a guild: nickname, guild avatar, guild banner, and/or " +
        'guild bio. Avatar and banner accept a data URI or a file source (path/url/data).',
      inputSchema: modifyCurrentMemberInput,
      annotations: IDEMPOTENT,
    },
    async (args) => modifyCurrentMember(args, ctx),
  );
};

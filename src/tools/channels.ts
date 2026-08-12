import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { DESTRUCTIVE, IDEMPOTENT, READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { CHANNEL_TYPE_CODES, channelTypeName, type ChannelType } from './channel-types.js';
import { requireConsent } from './consent.js';
import { formatPermissions, parsePermissions, permissionName, type PermissionName } from './permissions.js';
import { errorResult, textResult } from './result.js';
import { channelType, consent, snowflake } from './schemas.js';

const listChannelsInput = {
  guildId: snowflake.describe('The ID of the guild whose channels to list.'),
};

const getChannelInput = {
  channelId: snowflake.describe('The ID of the channel to fetch.'),
};

const overwriteSchema = z.object({
  id: snowflake.describe('The role or member ID this overwrite applies to.'),
  type: z.enum(['role', 'member']).describe('Whether "id" is a role or a member.'),
  allow: z.array(permissionName).optional().describe('Permissions to allow.'),
  deny: z.array(permissionName).optional().describe('Permissions to deny.'),
});

const forumTagSchema = z.object({
  name: z.string().min(1).max(20).describe('Tag name (1-20 characters).'),
  emojiId: snowflake.optional().describe('Custom emoji ID for the tag.'),
  emojiName: z.string().optional().describe('Unicode emoji character for the tag.'),
  moderated: z.boolean().optional().describe('Whether only moderators can apply this tag.'),
});

const defaultReactionEmojiSchema = z
  .object({
    emojiId: snowflake.optional().describe('Custom emoji ID for the default reaction.'),
    emojiName: z.string().optional().describe('Unicode emoji character for the default reaction.'),
  })
  .refine((e) => !(e.emojiId && e.emojiName), 'Provide only one of "emojiId" or "emojiName".');

const videoQualityModeSchema = z.enum(['auto', 'full']).describe('Video quality mode (voice).');

const defaultSortOrderSchema = z
  .enum(['latestActivity', 'creationDate'])
  .describe('Forum post sort order.');

const defaultForumLayoutSchema = z
  .enum(['notSet', 'listView', 'galleryView'])
  .describe('Default forum layout.');

const autoArchiveDurationSchema = z
  .number()
  .int()
  .refine((n) => [60, 1440, 4320, 10080].includes(n), 'one of 60, 1440, 4320, or 10080 minutes')
  .describe('Auto-archive duration in minutes (60, 1440, 4320, or 10080).');

const modifyChannelInput = {
  channelId: snowflake.describe('The ID of the channel to modify.'),
  name: z.string().min(1).max(100).optional().describe('New channel name (1-100 characters).'),
  topic: z
    .string()
    .max(1024)
    .optional()
    .describe('New channel topic (displayed as its description, up to 1024 characters).'),
  nsfw: z.boolean().optional().describe('Whether the channel is marked NSFW.'),
  slowmodeSeconds: z
    .number()
    .int()
    .min(0)
    .max(21600)
    .optional()
    .describe('Slowmode cooldown per user in seconds (0-21600; 0 disables it).'),
  position: z.number().int().optional().describe('The channel sort position.'),
  bitrate: z
    .number()
    .int()
    .min(8000)
    .max(384000)
    .optional()
    .describe('Voice bitrate in bits per second (voice channels only).'),
  userLimit: z
    .number()
    .int()
    .min(0)
    .max(99)
    .optional()
    .describe('User limit (0-99, voice channels only; 0 means unlimited).'),
  rtcRegion: z.string().min(1).optional().describe('Voice region (e.g. "europe", "us-east").'),
  videoQualityMode: videoQualityModeSchema.optional(),
  defaultAutoArchiveDuration: autoArchiveDurationSchema.optional(),
  defaultThreadRateLimitPerUser: z
    .number()
    .int()
    .min(0)
    .max(21600)
    .optional()
    .describe('Default slowmode for threads created in this channel (seconds).'),
  availableTags: z.array(forumTagSchema).max(20).optional().describe('Forum tags (forum channels).'),
  defaultReactionEmoji: defaultReactionEmojiSchema.optional(),
  defaultSortOrder: defaultSortOrderSchema.optional(),
  defaultForumLayout: defaultForumLayoutSchema.optional(),
  permissionOverwrites: z
    .array(overwriteSchema)
    .optional()
    .describe('Replaces permission overwrites with this list.'),
};

const createChannelInput = {
  guildId: snowflake.describe('The ID of the guild to create the channel in.'),
  name: z.string().min(1).max(100).describe('The channel name (1-100 characters).'),
  type: channelType,
  topic: z
    .string()
    .max(1024)
    .optional()
    .describe('The channel topic (description, up to 1024 characters).'),
  nsfw: z.boolean().optional().describe('Whether the channel is marked NSFW.'),
  parentId: snowflake
    .optional()
    .describe('The parent category or channel to nest this channel under.'),
  position: z.number().int().optional().describe('The channel sort position.'),
  bitrate: z
    .number()
    .int()
    .min(8000)
    .max(384000)
    .optional()
    .describe('Voice bitrate in bits per second (voice channels only).'),
  userLimit: z
    .number()
    .int()
    .min(0)
    .max(99)
    .optional()
    .describe('User limit (0-99, voice channels only; 0 means unlimited).'),
  rtcRegion: z.string().min(1).optional().describe('Voice region (e.g. "europe", "us-east").'),
  videoQualityMode: videoQualityModeSchema.optional(),
  permissionOverwrites: z.array(overwriteSchema).optional().describe('Initial permission overwrites.'),
  availableTags: z.array(forumTagSchema).max(20).optional().describe('Forum tags (forum channels).'),
  defaultReactionEmoji: defaultReactionEmojiSchema.optional(),
  defaultSortOrder: defaultSortOrderSchema.optional(),
  defaultForumLayout: defaultForumLayoutSchema.optional(),
  defaultThreadRateLimitPerUser: z
    .number()
    .int()
    .min(0)
    .max(21600)
    .optional()
    .describe('Default slowmode for threads created in this channel (seconds).'),
  defaultAutoArchiveDuration: autoArchiveDurationSchema.optional(),
};

const deleteChannelInput = {
  channelId: snowflake.describe('The ID of the channel to delete.'),
  confirm: consent,
};

const listActiveThreadsInput = {
  channelId: snowflake.describe('The ID of the channel to list active threads for.'),
};

const createThreadInput = {
  channelId: snowflake.describe('The ID of the channel (or forum post) to create the thread in.'),
  name: z.string().min(1).max(100).describe('Thread name (1-100 characters).'),
  messageId: snowflake
    .optional()
    .describe('Start the thread from an existing message in the channel.'),
  type: z
    .enum(['public', 'private'])
    .optional()
    .describe('Thread type (ignored when starting from a message).'),
  autoArchiveDuration: autoArchiveDurationSchema.optional(),
  rateLimitPerUser: z
    .number()
    .int()
    .min(0)
    .max(21600)
    .optional()
    .describe('Slowmode per user in seconds (threads only).'),
};

const modifyThreadInput = {
  threadId: snowflake.describe('The ID of the thread to modify.'),
  name: z.string().min(1).max(100).optional().describe('New thread name.'),
  archived: z.boolean().optional().describe('Whether the thread is archived.'),
  locked: z.boolean().optional().describe('Whether the thread is locked (moderators only).'),
  autoArchiveDuration: autoArchiveDurationSchema.optional(),
  rateLimitPerUser: z
    .number()
    .int()
    .min(0)
    .max(21600)
    .optional()
    .describe('Slowmode per user in seconds.'),
  appliedTags: z.array(snowflake).optional().describe('Forum tag IDs to apply.'),
};

const editChannelPermissionsInput = {
  channelId: snowflake.describe('The ID of the channel.'),
  overwriteId: snowflake.describe('The role or member ID to set permissions for.'),
  type: z.enum(['role', 'member']).describe('Whether "overwriteId" is a role or a member.'),
  allow: z.array(permissionName).optional().describe('Permissions to allow.'),
  deny: z.array(permissionName).optional().describe('Permissions to deny.'),
};

const deleteChannelPermissionsInput = {
  channelId: snowflake.describe('The ID of the channel.'),
  overwriteId: snowflake.describe('The role or member ID whose overwrite to remove.'),
};

export interface ListChannelsArgs {
  readonly guildId: string;
}
export interface GetChannelArgs {
  readonly channelId: string;
}
export type ModifyChannelArgs = z.infer<z.ZodObject<typeof modifyChannelInput>>;
export type CreateChannelArgs = z.infer<z.ZodObject<typeof createChannelInput>>;
export interface DeleteChannelArgs {
  readonly channelId: string;
  readonly confirm?: true;
}
export interface ListActiveThreadsArgs {
  readonly channelId: string;
}
export type CreateThreadArgs = z.infer<z.ZodObject<typeof createThreadInput>>;
export type ModifyThreadArgs = z.infer<z.ZodObject<typeof modifyThreadInput>>;
export type EditChannelPermissionsArgs = z.infer<z.ZodObject<typeof editChannelPermissionsInput>>;

export interface DeleteChannelPermissionsArgs {
  readonly channelId: string;
  readonly overwriteId: string;
}

interface RawOverwrite {
  readonly id: string;
  readonly type: number;
  readonly allow: string;
  readonly deny: string;
}

interface RawChannel {
  readonly id: string;
  readonly name: string;
  readonly type: number;
  readonly topic?: string | null;
  readonly nsfw?: boolean;
  readonly position?: number;
  readonly parent_id?: string | null;
  readonly rate_limit_per_user?: number;
  readonly bitrate?: number;
  readonly user_limit?: number;
  readonly rtc_region?: string | null;
  readonly video_quality_mode?: number;
  readonly flags?: number;
  readonly last_message_id?: string | null;
  readonly permission_overwrites?: RawOverwrite[];
}

export interface OverwriteSummary {
  readonly id: string;
  readonly type: 'role' | 'member';
  readonly allow: PermissionName[];
  readonly deny: PermissionName[];
}

export interface ChannelSummary {
  readonly id: string;
  readonly name: string;
  readonly type: number;
  readonly typeName?: ChannelType;
  readonly topic?: string | null;
  readonly nsfw?: boolean;
  readonly position?: number;
  readonly parentId?: string | null;
  readonly slowmodeSeconds?: number;
  readonly bitrate?: number;
  readonly userLimit?: number;
  readonly rtcRegion?: string | null;
  readonly videoQualityMode?: number;
  readonly flags?: number;
  readonly lastMessageId?: string | null;
  readonly permissionOverwrites?: OverwriteSummary[];
}

export const summarizeChannel = (channel: RawChannel): ChannelSummary => ({
  id: channel.id,
  name: channel.name,
  type: channel.type,
  typeName: channelTypeName(channel.type),
  topic: channel.topic,
  nsfw: channel.nsfw,
  position: channel.position,
  parentId: channel.parent_id,
  slowmodeSeconds: channel.rate_limit_per_user,
  bitrate: channel.bitrate,
  userLimit: channel.user_limit,
  rtcRegion: channel.rtc_region,
  videoQualityMode: channel.video_quality_mode,
  flags: channel.flags,
  lastMessageId: channel.last_message_id,
  permissionOverwrites: channel.permission_overwrites?.map((ow) => ({
    id: ow.id,
    type: ow.type === 0 ? 'role' : 'member',
    allow: formatPermissions(ow.allow),
    deny: formatPermissions(ow.deny),
  })),
});

const VIDEO_QUALITY_CODES = { auto: 1, full: 2 } as const;
const SORT_ORDER_CODES = { latestActivity: 0, creationDate: 1 } as const;
const FORUM_LAYOUT_CODES = { notSet: 0, listView: 1, galleryView: 2 } as const;

const normalizeOverwrite = (
  ow: { id: string; type: 'role' | 'member'; allow?: PermissionName[]; deny?: PermissionName[] },
): Record<string, unknown> => ({
  id: ow.id,
  type: ow.type === 'role' ? 0 : 1,
  allow: ow.allow ? parsePermissions(ow.allow) : undefined,
  deny: ow.deny ? parsePermissions(ow.deny) : undefined,
});

/** Applies the shared channel-body fields (voice, forum, overwrites) to `body`. */
const applyChannelSettings = (
  body: Record<string, unknown>,
  args: ModifyChannelArgs | CreateChannelArgs,
): void => {
  if (args.bitrate !== undefined) body.bitrate = args.bitrate;
  if (args.userLimit !== undefined) body.user_limit = args.userLimit;
  if (args.rtcRegion !== undefined) body.rtc_region = args.rtcRegion;
  if (args.videoQualityMode !== undefined) {
    body.video_quality_mode = VIDEO_QUALITY_CODES[args.videoQualityMode];
  }
  if ('defaultAutoArchiveDuration' in args && args.defaultAutoArchiveDuration !== undefined) {
    body.default_auto_archive_duration = args.defaultAutoArchiveDuration;
  }
  if ('defaultThreadRateLimitPerUser' in args && args.defaultThreadRateLimitPerUser !== undefined) {
    body.default_thread_rate_limit_per_user = args.defaultThreadRateLimitPerUser;
  }
  if ('availableTags' in args && args.availableTags !== undefined) {
    body.available_tags = args.availableTags.map((tag) => ({
      name: tag.name,
      emoji_id: tag.emojiId,
      emoji_name: tag.emojiName,
      moderated: tag.moderated,
    }));
  }
  if ('defaultReactionEmoji' in args && args.defaultReactionEmoji !== undefined) {
    body.default_reaction_emoji = {
      emoji_id: args.defaultReactionEmoji.emojiId,
      emoji_name: args.defaultReactionEmoji.emojiName,
    };
  }
  if ('defaultSortOrder' in args && args.defaultSortOrder !== undefined) {
    body.default_sort_order = SORT_ORDER_CODES[args.defaultSortOrder];
  }
  if ('defaultForumLayout' in args && args.defaultForumLayout !== undefined) {
    body.default_forum_layout = FORUM_LAYOUT_CODES[args.defaultForumLayout];
  }
  if ('permissionOverwrites' in args && args.permissionOverwrites !== undefined) {
    body.permission_overwrites = args.permissionOverwrites.map(normalizeOverwrite);
  }
};

export const listChannels = async (
  args: ListChannelsArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('list_channels', () =>
    ctx.discord.request<RawChannel[]>('GET', `/guilds/${args.guildId}/channels`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.map(summarizeChannel), null, 2));
};

export const getChannel = async (
  args: GetChannelArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('get_channel', () =>
    ctx.discord.request<RawChannel>('GET', `/channels/${args.channelId}`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeChannel(result.value), null, 2));
};

export const modifyChannel = async (
  args: ModifyChannelArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = {};
  if (args.name !== undefined) body.name = args.name;
  if (args.topic !== undefined) body.topic = args.topic;
  if (args.nsfw !== undefined) body.nsfw = args.nsfw;
  if (args.slowmodeSeconds !== undefined) body.rate_limit_per_user = args.slowmodeSeconds;
  if (args.position !== undefined) body.position = args.position;
  applyChannelSettings(body, args);

  const result = await attempt('modify_channel', () =>
    ctx.discord.request<RawChannel>('PATCH', `/channels/${args.channelId}`, { body }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeChannel(result.value), null, 2));
};

export const createChannel = async (
  args: CreateChannelArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = {
    name: args.name,
    type: CHANNEL_TYPE_CODES[args.type ?? 'text'],
  };
  if (args.topic !== undefined) body.topic = args.topic;
  if (args.nsfw !== undefined) body.nsfw = args.nsfw;
  if (args.parentId !== undefined) body.parent_id = args.parentId;
  if (args.position !== undefined) body.position = args.position;
  applyChannelSettings(body, args);

  const result = await attempt('create_channel', () =>
    ctx.discord.request<RawChannel>('POST', `/guilds/${args.guildId}/channels`, { body }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeChannel(result.value), null, 2));
};

export const deleteChannel = async (
  args: DeleteChannelArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const gate = requireConsent(args.confirm);
  if (gate) return gate;

  const result = await attempt('delete_channel', () =>
    ctx.discord.request<unknown>('DELETE', `/channels/${args.channelId}`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Deleted channel ${args.channelId}.`);
};

export const listActiveThreads = async (
  args: ListActiveThreadsArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('list_active_threads', () =>
    ctx.discord.request<{ readonly threads: RawChannel[] }>(
      'GET',
      `/channels/${args.channelId}/threads/active`,
    ),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.threads.map(summarizeChannel), null, 2));
};

export const createThread = async (
  args: CreateThreadArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = { name: args.name };
  if (args.autoArchiveDuration !== undefined) {
    body.auto_archive_duration = args.autoArchiveDuration;
  }

  let route: string;
  if (args.messageId) {
    route = `/channels/${args.channelId}/messages/${args.messageId}/threads`;
  } else {
    route = `/channels/${args.channelId}/threads`;
    body.type = args.type === 'private' ? 12 : 11;
    if (args.rateLimitPerUser !== undefined) body.rate_limit_per_user = args.rateLimitPerUser;
  }

  const result = await attempt('create_thread', () =>
    ctx.discord.request<RawChannel>('POST', route, { body }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeChannel(result.value), null, 2));
};

export const modifyThread = async (
  args: ModifyThreadArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = {};
  if (args.name !== undefined) body.name = args.name;
  if (args.archived !== undefined) body.archived = args.archived;
  if (args.locked !== undefined) body.locked = args.locked;
  if (args.autoArchiveDuration !== undefined) body.auto_archive_duration = args.autoArchiveDuration;
  if (args.rateLimitPerUser !== undefined) body.rate_limit_per_user = args.rateLimitPerUser;
  if (args.appliedTags !== undefined) body.applied_tags = args.appliedTags;

  const result = await attempt('modify_thread', () =>
    ctx.discord.request<RawChannel>('PATCH', `/channels/${args.threadId}`, { body }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeChannel(result.value), null, 2));
};

export const editChannelPermissions = async (
  args: EditChannelPermissionsArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = {
    type: args.type === 'role' ? '0' : '1',
    allow: args.allow ? parsePermissions(args.allow) : '0',
    deny: args.deny ? parsePermissions(args.deny) : '0',
  };

  const result = await attempt('edit_channel_permissions', () =>
    ctx.discord.request<unknown>(
      'PUT',
      `/channels/${args.channelId}/permissions/${args.overwriteId}`,
      { body },
    ),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(
    `Set ${args.type} ${args.overwriteId} permissions on channel ${args.channelId}.`,
  );
};

export const deleteChannelPermissions = async (
  args: DeleteChannelPermissionsArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('delete_channel_permissions', () =>
    ctx.discord.request<unknown>(
      'DELETE',
      `/channels/${args.channelId}/permissions/${args.overwriteId}`,
    ),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(
    `Deleted permission overwrite ${args.overwriteId} on channel ${args.channelId}.`,
  );
};

export const registerChannelTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'list_channels',
    {
      title: 'List channels',
      description: 'List the channels in a guild, with type names, categories, and settings.',
      inputSchema: listChannelsInput,
      annotations: READ_ONLY,
    },
    async (args) => listChannels(args, ctx),
  );
  server.registerTool(
    'get_channel',
    {
      title: 'Get channel',
      description: 'Get a single channel by ID, including its settings and permission overwrites.',
      inputSchema: getChannelInput,
      annotations: READ_ONLY,
    },
    async (args) => getChannel(args, ctx),
  );
  server.registerTool(
    'modify_channel',
    {
      title: 'Modify channel',
      description:
        'Modify a channel: name, topic, NSFW, slowmode, position, voice settings, forum settings, ' +
        'and permission overwrites.',
      inputSchema: modifyChannelInput,
      annotations: IDEMPOTENT,
    },
    async (args) => modifyChannel(args, ctx),
  );
  server.registerTool(
    'create_channel',
    {
      title: 'Create channel',
      description:
        'Create a channel in a guild, with voice settings, forum settings, and permission overwrites.',
      inputSchema: createChannelInput,
    },
    async (args) => createChannel(args, ctx),
  );
  server.registerTool(
    'delete_channel',
    {
      title: 'Delete channel',
      description: 'Delete a channel. Requires explicit consent ("confirm": true).',
      inputSchema: deleteChannelInput,
      annotations: DESTRUCTIVE,
    },
    async (args) => deleteChannel(args, ctx),
  );
  server.registerTool(
    'list_active_threads',
    {
      title: 'List active threads',
      description: 'List the active threads in a channel.',
      inputSchema: listActiveThreadsInput,
      annotations: READ_ONLY,
    },
    async (args) => listActiveThreads(args, ctx),
  );
  server.registerTool(
    'create_thread',
    {
      title: 'Create thread',
      description: 'Create a thread in a channel, or start one from an existing message.',
      inputSchema: createThreadInput,
    },
    async (args) => createThread(args, ctx),
  );
  server.registerTool(
    'modify_thread',
    {
      title: 'Modify thread',
      description: 'Modify a thread: name, archive state, lock, slowmode, and applied tags.',
      inputSchema: modifyThreadInput,
      annotations: IDEMPOTENT,
    },
    async (args) => modifyThread(args, ctx),
  );
  server.registerTool(
    'edit_channel_permissions',
    {
      title: 'Edit channel permissions',
      description:
        'Set a permission overwrite for a role or member on a channel, using named permissions.',
      inputSchema: editChannelPermissionsInput,
      annotations: IDEMPOTENT,
    },
    async (args) => editChannelPermissions(args, ctx),
  );
  server.registerTool(
    'delete_channel_permissions',
    {
      title: 'Delete channel permissions',
      description:
        'Remove a role or member permission overwrite from a channel, reverting it to channel defaults.',
      inputSchema: deleteChannelPermissionsInput,
      annotations: IDEMPOTENT,
    },
    async (args) => deleteChannelPermissions(args, ctx),
  );
};

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { DESTRUCTIVE, IDEMPOTENT, READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { requireConsent } from './consent.js';
import { errorResult, textResult } from './result.js';
import { consent, snowflake } from './schemas.js';

const ENTITY_CODES = { stageInstance: 1, voice: 2, external: 3 } as const;
const ENTITY_NAMES: Record<number, string> = { 1: 'stageInstance', 2: 'voice', 3: 'external' };

const STATUS_CODES = { scheduled: 1, active: 2, completed: 3, canceled: 4 } as const;
const STATUS_NAMES: Record<number, string> = { 1: 'scheduled', 2: 'active', 3: 'completed', 4: 'canceled' };

/** Guild events are always guild-only (privacy level 2). */
const GUILD_ONLY = 2;

const scheduledEventInput = z
  .object({
    guildId: snowflake.describe('The ID of the guild.'),
    name: z.string().min(1).max(100).describe('The event name (1-100 characters).'),
    entityType: z
      .enum(['stageInstance', 'voice', 'external'])
      .describe('The type of event: a stage, a voice channel, or an external location.'),
    scheduledStartTime: z.string().datetime({ offset: true }).describe('ISO-8601 start time.'),
    scheduledEndTime: z.string().datetime({ offset: true }).optional().describe('ISO-8601 end time.'),
    description: z.string().max(1000).optional().describe('The event description (up to 1000 characters).'),
    channelId: snowflake
      .optional()
      .describe('The stage or voice channel (required for stageInstance and voice events).'),
    location: z.string().max(100).optional().describe('The external location (external events).'),
  })
  .superRefine((args, ctx) => {
    if (args.entityType === 'external' && (args.location === undefined || args.location.length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'external events require "location".' });
    }
    if (args.entityType !== 'external' && args.channelId === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'stageInstance and voice events require "channelId".' });
    }
  });

const modifyScheduledEventInput = z
  .object({
    guildId: snowflake.describe('The ID of the guild.'),
    eventId: snowflake.describe('The ID of the event to modify.'),
    name: z.string().min(1).max(100).optional().describe('The event name (1-100 characters).'),
    entityType: z.enum(['stageInstance', 'voice', 'external']).optional().describe('The type of event.'),
    scheduledStartTime: z.string().datetime({ offset: true }).optional().describe('ISO-8601 start time.'),
    scheduledEndTime: z.string().datetime({ offset: true }).optional().describe('ISO-8601 end time.'),
    description: z.string().max(1000).optional().describe('The event description (up to 1000 characters).'),
    channelId: snowflake.optional().describe('The stage or voice channel.'),
    location: z.string().max(100).optional().describe('The external location (external events).'),
    status: z
      .enum(['scheduled', 'active', 'completed', 'canceled'])
      .optional()
      .describe('The event status (set "canceled" to cancel an event).'),
    reason: z.string().max(512).optional().describe('Audit-log reason.'),
  })
  .superRefine((args, ctx) => {
    if (
      args.name === undefined &&
      args.entityType === undefined &&
      args.scheduledStartTime === undefined &&
      args.scheduledEndTime === undefined &&
      args.description === undefined &&
      args.channelId === undefined &&
      args.location === undefined &&
      args.status === undefined
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Provide at least one field to modify.' });
    }
  });

const deleteScheduledEventInput = {
  guildId: snowflake.describe('The ID of the guild.'),
  eventId: snowflake.describe('The ID of the event to delete.'),
  confirm: consent,
};

export type CreateScheduledEventArgs = z.infer<typeof scheduledEventInput>;
export type ModifyScheduledEventArgs = z.infer<typeof modifyScheduledEventInput>;

export interface DeleteScheduledEventArgs {
  readonly guildId: string;
  readonly eventId: string;
  readonly confirm?: true;
}

interface RawScheduledEvent {
  readonly id: string;
  readonly guild_id: string;
  readonly channel_id?: string | null;
  readonly creator_id?: string | null;
  readonly name: string;
  readonly description?: string | null;
  readonly scheduled_start_time: string;
  readonly scheduled_end_time?: string | null;
  readonly privacy_level: number;
  readonly status: number;
  readonly entity_type: number;
  readonly entity_id?: string | null;
  readonly entity_metadata?: { readonly location?: string } | null;
  readonly user_count?: number;
}

export const summarizeScheduledEvent = (event: RawScheduledEvent): Record<string, unknown> => ({
  id: event.id,
  guildId: event.guild_id,
  channelId: event.channel_id,
  creatorId: event.creator_id,
  name: event.name,
  description: event.description,
  scheduledStartTime: event.scheduled_start_time,
  scheduledEndTime: event.scheduled_end_time,
  privacyLevel: event.privacy_level,
  status: STATUS_NAMES[event.status],
  entityType: ENTITY_NAMES[event.entity_type],
  entityId: event.entity_id,
  entityMetadata: event.entity_metadata,
  userCount: event.user_count,
});

/** Maps friendly event fields to Discord's numeric JSON body. */
const eventBody = (
  args: Partial<CreateScheduledEventArgs> & { readonly status?: keyof typeof STATUS_CODES },
): Record<string, unknown> => {
  const body: Record<string, unknown> = {};
  if (args.channelId !== undefined) body.channel_id = args.channelId;
  if (args.name !== undefined) body.name = args.name;
  if (args.entityType !== undefined) body.entity_type = ENTITY_CODES[args.entityType];
  if (args.scheduledStartTime !== undefined) body.scheduled_start_time = args.scheduledStartTime;
  if (args.scheduledEndTime !== undefined) body.scheduled_end_time = args.scheduledEndTime;
  if (args.description !== undefined) body.description = args.description;
  if (args.location !== undefined) body.entity_metadata = { location: args.location };
  if (args.status !== undefined) body.status = STATUS_CODES[args.status];
  return body;
};

export const listScheduledEvents = async (
  args: { readonly guildId: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('list_scheduled_events', () =>
    ctx.discord.request<RawScheduledEvent[]>('GET', `/guilds/${args.guildId}/scheduled-events`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.map(summarizeScheduledEvent), null, 2));
};

export const getScheduledEvent = async (
  args: { readonly guildId: string; readonly eventId: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('get_scheduled_event', () =>
    ctx.discord.request<RawScheduledEvent>('GET', `/guilds/${args.guildId}/scheduled-events/${args.eventId}`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeScheduledEvent(result.value), null, 2));
};

export const createScheduledEvent = async (
  args: CreateScheduledEventArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body = eventBody(args);
  body.privacy_level = GUILD_ONLY;

  const result = await attempt('create_scheduled_event', () =>
    ctx.discord.request<RawScheduledEvent>('POST', `/guilds/${args.guildId}/scheduled-events`, { body }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeScheduledEvent(result.value), null, 2));
};

export const modifyScheduledEvent = async (
  args: ModifyScheduledEventArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('modify_scheduled_event', () =>
    ctx.discord.request<RawScheduledEvent>(
      'PATCH',
      `/guilds/${args.guildId}/scheduled-events/${args.eventId}`,
      { body: eventBody(args), reason: args.reason },
    ),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeScheduledEvent(result.value), null, 2));
};

export const deleteScheduledEvent = async (
  args: DeleteScheduledEventArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const gate = requireConsent(args.confirm);
  if (gate) return gate;

  const result = await attempt('delete_scheduled_event', () =>
    ctx.discord.request<unknown>('DELETE', `/guilds/${args.guildId}/scheduled-events/${args.eventId}`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Deleted scheduled event ${args.eventId} from guild ${args.guildId}.`);
};

const getScheduledEventUsersInput = {
  guildId: snowflake.describe('The ID of the guild.'),
  eventId: snowflake.describe('The ID of the event.'),
  limit: z.number().int().min(1).max(100).optional().describe('Maximum number of users (1-100, default 100).'),
  before: snowflake.optional().describe('Return users before this user ID.'),
  after: snowflake.optional().describe('Return users after this user ID.'),
};

export interface GetScheduledEventUsersArgs {
  readonly guildId: string;
  readonly eventId: string;
  readonly limit?: number;
  readonly before?: string;
  readonly after?: string;
}

interface RawEventUser {
  readonly user?: { readonly id: string; readonly username: string; readonly discriminator: string };
  readonly member?: { readonly user?: { readonly id: string; readonly username: string; readonly discriminator: string } };
}

export const getScheduledEventUsers = async (
  args: GetScheduledEventUsersArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('get_scheduled_event_users', () =>
    ctx.discord.request<RawEventUser[]>('GET', `/guilds/${args.guildId}/scheduled-events/${args.eventId}/users`, {
      query: { limit: args.limit, before: args.before, after: args.after },
    }),
  );
  if (!result.ok) return errorResult(result.error);
  const users = result.value.map((entry) => {
    const user = entry.user ?? entry.member?.user;
    return { id: user?.id, username: user?.username, discriminator: user?.discriminator };
  });
  return textResult(JSON.stringify({ users }, null, 2));
};

export const registerScheduledEventTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'list_scheduled_events',
    {
      title: 'List scheduled events',
      description: 'List the scheduled events in a guild.',
      inputSchema: { guildId: snowflake.describe('The ID of the guild.') },
      annotations: READ_ONLY,
    },
    async (args) => listScheduledEvents(args, ctx),
  );
  server.registerTool(
    'get_scheduled_event',
    {
      title: 'Get scheduled event',
      description: 'Get a single scheduled event by ID.',
      inputSchema: {
        guildId: snowflake.describe('The ID of the guild.'),
        eventId: snowflake.describe('The ID of the event.'),
      },
      annotations: READ_ONLY,
    },
    async (args) => getScheduledEvent(args, ctx),
  );
  server.registerTool(
    'create_scheduled_event',
    {
      title: 'Create scheduled event',
      description: 'Create a guild scheduled event (stage, voice, or external).',
      inputSchema: scheduledEventInput,
    },
    async (args) => createScheduledEvent(args, ctx),
  );
  server.registerTool(
    'modify_scheduled_event',
    {
      title: 'Modify scheduled event',
      description: 'Modify a scheduled event: name, times, location, channel, or status.',
      inputSchema: modifyScheduledEventInput,
      annotations: IDEMPOTENT,
    },
    async (args) => modifyScheduledEvent(args, ctx),
  );
  server.registerTool(
    'delete_scheduled_event',
    {
      title: 'Delete scheduled event',
      description: 'Delete a scheduled event. Requires explicit consent ("confirm": true).',
      inputSchema: deleteScheduledEventInput,
      annotations: DESTRUCTIVE,
    },
    async (args) => deleteScheduledEvent(args, ctx),
  );
  server.registerTool(
    'get_scheduled_event_users',
    {
      title: 'Get scheduled event users',
      description: 'List the users interested in a scheduled event.',
      inputSchema: getScheduledEventUsersInput,
      annotations: READ_ONLY,
    },
    async (args) => getScheduledEventUsers(args, ctx),
  );
};

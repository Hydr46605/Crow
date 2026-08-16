import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { IDEMPOTENT, READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { errorResult, textResult } from './result.js';
import { snowflake } from './schemas.js';

const voiceStateUserSchema = z
  .union([snowflake, z.literal('@me')])
  .describe('The user\'s ID, or "@me" for the bot itself.');

interface RawVoiceState {
  readonly channel_id?: string | null;
  readonly session_id?: string;
  readonly deaf?: boolean;
  readonly mute?: boolean;
  readonly self_deaf?: boolean;
  readonly self_mute?: boolean;
  readonly self_stream?: boolean;
  readonly self_video?: boolean;
  readonly suppress?: boolean;
  readonly request_to_speak_timestamp?: string | null;
}

/** Maps a Discord voice-state object to a compact, named summary. */
export const summarizeVoiceState = (state: RawVoiceState): Record<string, unknown> => ({
  channelId: state.channel_id ?? null,
  sessionId: state.session_id ?? null,
  deaf: state.deaf ?? false,
  mute: state.mute ?? false,
  selfDeaf: state.self_deaf ?? false,
  selfMute: state.self_mute ?? false,
  selfStream: state.self_stream ?? false,
  selfVideo: state.self_video ?? false,
  suppress: state.suppress ?? false,
  requestToSpeakTimestamp: state.request_to_speak_timestamp ?? null,
});

export const modifyVoiceStateInput = z
  .object({
    guildId: snowflake.describe('The ID of the guild.'),
    userId: voiceStateUserSchema,
    channelId: snowflake.optional().describe('The stage channel to move the user to.'),
    suppress: z
      .boolean()
      .optional()
      .describe('Whether to suppress the user (mute their voice for others, stage channels).'),
    requestToSpeak: z
      .boolean()
      .optional()
      .describe('Whether to request (true) or clear a request (false) to speak.'),
  })
  .superRefine((args, ctx) => {
    if (
      args.channelId === undefined &&
      args.suppress === undefined &&
      args.requestToSpeak === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one of "channelId", "suppress", or "requestToSpeak".',
      });
    }
    if (args.requestToSpeak !== undefined && args.userId !== '@me') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '"requestToSpeak" is only valid for the bot itself (set "userId" to "@me").',
      });
    }
  });

export type ModifyVoiceStateArgs = z.infer<typeof modifyVoiceStateInput>;

export const getVoiceState = async (
  args: { readonly guildId: string; readonly userId: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('get_voice_state', () =>
    ctx.discord.request<RawVoiceState>(
      'GET',
      `/guilds/${args.guildId}/voice-states/${args.userId}`,
    ),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeVoiceState(result.value), null, 2));
};

export const modifyVoiceState = async (
  args: ModifyVoiceStateArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = {};
  if (args.channelId !== undefined) body.channel_id = args.channelId;
  if (args.suppress !== undefined) body.suppress = args.suppress;
  if (args.requestToSpeak !== undefined) {
    body.request_to_speak_timestamp = args.requestToSpeak ? new Date().toISOString() : null;
  }

  const result = await attempt('modify_voice_state', () =>
    ctx.discord.request<unknown>('PATCH', `/guilds/${args.guildId}/voice-states/${args.userId}`, {
      body,
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Updated voice state for user ${args.userId} in guild ${args.guildId}.`);
};

export const registerVoiceTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'get_voice_state',
    {
      title: 'Get voice state',
      description:
        'Get a user\'s current voice state (channel, mute/deafen, streaming, and stage suppression), ' +
        'or the bot\'s own with "@me".',
      inputSchema: {
        guildId: snowflake.describe('The ID of the guild.'),
        userId: voiceStateUserSchema,
      },
      annotations: READ_ONLY,
    },
    async (args) => getVoiceState(args, ctx),
  );
  server.registerTool(
    'modify_voice_state',
    {
      title: 'Modify voice state',
      description:
        'Modify a voice state in a stage channel: move a user, suppress them, or request to speak ' +
        '(use "@me" as userId for the bot itself; requestToSpeak is only valid for "@me").',
      inputSchema: modifyVoiceStateInput,
      annotations: IDEMPOTENT,
    },
    async (args) => modifyVoiceState(args, ctx),
  );
};

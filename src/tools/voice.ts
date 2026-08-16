import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { IDEMPOTENT } from './annotations.js';
import { attempt } from './attempt.js';
import { errorResult, textResult } from './result.js';
import { snowflake } from './schemas.js';

const voiceStateUserSchema = z
  .union([snowflake, z.literal('@me')])
  .describe('The user\'s ID, or "@me" for the bot itself.');

const modifyVoiceStateInput = z
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
  });

export type ModifyVoiceStateArgs = z.infer<typeof modifyVoiceStateInput>;

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
    'modify_voice_state',
    {
      title: 'Modify voice state',
      description:
        'Modify a voice state in a stage channel: move a user, suppress them, or request to speak ' +
        '(use "@me" as userId for the bot itself).',
      inputSchema: modifyVoiceStateInput,
      annotations: IDEMPOTENT,
    },
    async (args) => modifyVoiceState(args, ctx),
  );
};

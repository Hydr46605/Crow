import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { errorResult, textResult } from './result.js';
import { snowflake } from './schemas.js';

const pollAnswerSchema = z
  .object({
    text: z.string().min(1).max(55).describe('Answer text (1-55 characters).'),
    emojiId: snowflake.optional().describe('Custom emoji ID for the answer.'),
    emojiName: z.string().min(1).max(64).optional().describe('Unicode emoji character for the answer.'),
  })
  .superRefine((answer, ctx) => {
    if (answer.emojiId && answer.emojiName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide only one of "emojiId" or "emojiName".',
      });
    }
  });

/** A poll attached to a message. Discriminated answers with an optional emoji. */
export const pollSchema = z.object({
  question: z.string().min(1).max(300).describe('The poll question (1-300 characters).'),
  answers: z.array(pollAnswerSchema).min(2).max(10).describe('2-10 poll answers.'),
  durationHours: z
    .number()
    .int()
    .min(1)
    .max(768)
    .optional()
    .describe('Hours the poll stays open (1-768, default 24).'),
  allowMultiselect: z.boolean().optional().describe('Whether users can select multiple answers.'),
});

export type PollInput = z.infer<typeof pollSchema>;

const pollEmoji = (answer: { readonly emojiId?: string; readonly emojiName?: string }): Record<string, unknown> | undefined => {
  if (answer.emojiId !== undefined) return { id: answer.emojiId };
  if (answer.emojiName !== undefined) return { name: answer.emojiName };
  return undefined;
};

/** Converts friendly poll input to Discord's poll create-request object. */
export const normalizePoll = (poll: PollInput): Record<string, unknown> => ({
  question: { text: poll.question },
  answers: poll.answers.map((answer) => ({
    poll_media: { text: answer.text, emoji: pollEmoji(answer) },
  })),
  duration: poll.durationHours,
  allow_multiselect: poll.allowMultiselect,
});

export interface RawPollMedia {
  readonly text?: string | null;
  readonly emoji?: { readonly id?: string | null; readonly name?: string | null } | null;
}

export interface RawPollAnswer {
  readonly answer_id?: number;
  readonly poll_media?: RawPollMedia;
}

export interface RawPoll {
  readonly question?: RawPollMedia;
  readonly answers?: readonly RawPollAnswer[];
  readonly expiry?: string | null;
  readonly allow_multiselect?: boolean;
  readonly layout_type?: number;
  readonly results?: {
    readonly is_finalized?: boolean;
    readonly answer_counts?: readonly {
      readonly id: number;
      readonly count: number;
      readonly me_voted: boolean;
    }[];
  };
}

/** Decodes a raw poll object into a friendly summary. */
export const summarizePoll = (poll: RawPoll): Record<string, unknown> => ({
  question: poll.question?.text ?? null,
  answers: (poll.answers ?? []).map((answer) => ({
    answerId: answer.answer_id,
    text: answer.poll_media?.text ?? null,
    emojiId: answer.poll_media?.emoji?.id ?? null,
    emojiName: answer.poll_media?.emoji?.name ?? null,
  })),
  expiry: poll.expiry,
  allowMultiselect: poll.allow_multiselect,
  layoutType: poll.layout_type,
  results: poll.results
    ? {
        isFinalized: poll.results.is_finalized,
        answerCounts: (poll.results.answer_counts ?? []).map((count) => ({
          answerId: count.id,
          count: count.count,
          meVoted: count.me_voted,
        })),
      }
    : undefined,
});

const getPollAnswerVotersInput = {
  channelId: snowflake.describe('The ID of the channel containing the poll message.'),
  messageId: snowflake.describe('The ID of the poll message.'),
  answerId: z.number().int().min(1).describe('The answer ID to list voters for.'),
  after: snowflake.optional().describe('Return voters after this user ID (for pagination).'),
  limit: z.number().int().min(1).max(100).optional().describe('Maximum number of voters (1-100, default 25).'),
};

const endPollInput = {
  channelId: snowflake.describe('The ID of the channel containing the poll message.'),
  messageId: snowflake.describe('The ID of the poll message to end.'),
};

export interface GetPollAnswerVotersArgs {
  readonly channelId: string;
  readonly messageId: string;
  readonly answerId: number;
  readonly after?: string;
  readonly limit?: number;
}

export interface EndPollArgs {
  readonly channelId: string;
  readonly messageId: string;
}

interface RawPollVoter {
  readonly id: string;
  readonly username: string;
  readonly discriminator: string;
}

export const getPollAnswerVoters = async (
  args: GetPollAnswerVotersArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('get_poll_answer_voters', () =>
    ctx.discord.request<{ readonly users: RawPollVoter[] }>(
      'GET',
      `/channels/${args.channelId}/polls/${args.messageId}/answers/${args.answerId}`,
      { query: { after: args.after, limit: args.limit } },
    ),
  );
  if (!result.ok) return errorResult(result.error);
  const users = result.value.users.map((user) => ({
    id: user.id,
    username: user.username,
    discriminator: user.discriminator,
  }));
  return textResult(JSON.stringify({ users }, null, 2));
};

export const endPoll = async (args: EndPollArgs, ctx: CrowContext): Promise<CallToolResult> => {
  const result = await attempt('end_poll', () =>
    ctx.discord.request<unknown>('POST', `/channels/${args.channelId}/polls/${args.messageId}/expire`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value, null, 2));
};

export const registerPollTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'get_poll_answer_voters',
    {
      title: 'Get poll answer voters',
      description: 'List the users who voted for a specific poll answer.',
      inputSchema: getPollAnswerVotersInput,
      annotations: READ_ONLY,
    },
    async (args) => getPollAnswerVoters(args, ctx),
  );
  server.registerTool(
    'end_poll',
    {
      title: 'End poll',
      description: 'Immediately end a poll and return the message with final results.',
      inputSchema: endPollInput,
    },
    async (args) => endPoll(args, ctx),
  );
};

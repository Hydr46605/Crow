import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { IDEMPOTENT, READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { errorResult, textResult } from './result.js';
import { snowflake } from './schemas.js';

const reactionEmoji = z
  .string()
  .min(1)
  .max(64)
  .describe('Unicode emoji (e.g. 👍) or a custom emoji as name:id (e.g. party:123456789012345678).');

const addReactionInput = {
  channelId: snowflake.describe('The ID of the channel containing the message.'),
  messageId: snowflake.describe('The ID of the message to react to.'),
  emoji: reactionEmoji,
};

const removeOwnReactionInput = {
  channelId: snowflake.describe('The ID of the channel containing the message.'),
  messageId: snowflake.describe('The ID of the message to unreact from.'),
  emoji: reactionEmoji,
};

const removeUserReactionInput = {
  channelId: snowflake.describe('The ID of the channel containing the message.'),
  messageId: snowflake.describe('The ID of the message to remove the reaction from.'),
  emoji: reactionEmoji,
  userId: snowflake.describe('The ID of the user whose reaction to remove.'),
};

const listReactionsInput = {
  channelId: snowflake.describe('The ID of the channel containing the message.'),
  messageId: snowflake.describe('The ID of the message whose reactions to list.'),
  emoji: reactionEmoji,
  limit: z.number().int().min(1).max(100).optional().describe('Maximum users to return (1-100).'),
  after: snowflake.optional().describe('Return users after this user ID (for pagination).'),
};

export interface ReactionArgs {
  readonly channelId: string;
  readonly messageId: string;
  readonly emoji: string;
}

export interface RemoveUserReactionArgs extends ReactionArgs {
  readonly userId: string;
}

export interface ListReactionsArgs extends ReactionArgs {
  readonly limit?: number;
  readonly after?: string;
}

/** Builds the reaction path with the emoji URL-encoded for the path segment. */
const reactionPath = (channelId: string, messageId: string, emoji: string): string =>
  `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`;

/** Builds a reaction route for a specific user ("@me" or a user ID). */
const reactionRoute = (channelId: string, messageId: string, emoji: string, target: string): string =>
  `${reactionPath(channelId, messageId, emoji)}/${target}`;

interface RawReactionUser {
  readonly id: string;
  readonly username: string;
  readonly discriminator: string;
  readonly bot?: boolean;
}

export interface ReactionUserSummary {
  readonly userId: string;
  readonly username: string;
  readonly discriminator: string;
  readonly bot: boolean;
}

export const summarizeReactionUser = (user: RawReactionUser): ReactionUserSummary => ({
  userId: user.id,
  username: user.username,
  discriminator: user.discriminator,
  bot: user.bot ?? false,
});

export const addReaction = async (args: ReactionArgs, ctx: CrowContext): Promise<CallToolResult> => {
  const result = await attempt('add_reaction', () =>
    ctx.discord.request<unknown>('PUT', reactionRoute(args.channelId, args.messageId, args.emoji, '@me')),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Added reaction ${args.emoji} to message ${args.messageId}.`);
};

export const removeOwnReaction = async (
  args: ReactionArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('remove_own_reaction', () =>
    ctx.discord.request<unknown>(
      'DELETE',
      reactionRoute(args.channelId, args.messageId, args.emoji, '@me'),
    ),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Removed own reaction ${args.emoji} from message ${args.messageId}.`);
};

export const removeUserReaction = async (
  args: RemoveUserReactionArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('remove_user_reaction', () =>
    ctx.discord.request<unknown>(
      'DELETE',
      reactionRoute(args.channelId, args.messageId, args.emoji, args.userId),
    ),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Removed ${args.userId}'s reaction ${args.emoji} from message ${args.messageId}.`);
};

export const listReactions = async (
  args: ListReactionsArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('list_reactions', () =>
    ctx.discord.request<RawReactionUser[]>(
      'GET',
      reactionPath(args.channelId, args.messageId, args.emoji),
      { query: { limit: args.limit, after: args.after } },
    ),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.map(summarizeReactionUser), null, 2));
};

export const registerReactionTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'add_reaction',
    {
      title: 'Add reaction',
      description: 'Add a reaction (unicode or custom emoji) to a message as the bot.',
      inputSchema: addReactionInput,
      annotations: IDEMPOTENT,
    },
    async (args) => addReaction(args, ctx),
  );
  server.registerTool(
    'remove_own_reaction',
    {
      title: 'Remove own reaction',
      description: "Remove the bot's own reaction from a message.",
      inputSchema: removeOwnReactionInput,
      annotations: IDEMPOTENT,
    },
    async (args) => removeOwnReaction(args, ctx),
  );
  server.registerTool(
    'remove_user_reaction',
    {
      title: 'Remove user reaction',
      description: "Remove another user's reaction from a message.",
      inputSchema: removeUserReactionInput,
      annotations: IDEMPOTENT,
    },
    async (args) => removeUserReaction(args, ctx),
  );
  server.registerTool(
    'list_reactions',
    {
      title: 'List reactions',
      description: 'List the users who reacted to a message with a given emoji.',
      inputSchema: listReactionsInput,
      annotations: READ_ONLY,
    },
    async (args) => listReactions(args, ctx),
  );
};

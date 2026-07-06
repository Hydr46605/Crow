import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { toErrorMessage } from '../discord/client.js';
import { errorResult, textResult } from './result.js';
import { snowflake } from './schemas.js';

const readMessagesInput = {
  channelId: snowflake,
  limit: z.number().int().min(1).max(100).optional(),
  before: snowflake.optional(),
  after: snowflake.optional(),
  around: snowflake.optional(),
};

const sendMessageInput = {
  channelId: snowflake,
  content: z.string().min(1).max(2000),
  replyTo: snowflake.optional(),
};

export interface ReadMessagesArgs {
  readonly channelId: string;
  readonly limit?: number;
  readonly before?: string;
  readonly after?: string;
  readonly around?: string;
}

export interface SendMessageArgs {
  readonly channelId: string;
  readonly content: string;
  readonly replyTo?: string;
}

interface RawMessage {
  readonly id: string;
  readonly channel_id: string;
  readonly author: { readonly id: string; readonly username: string };
  readonly content: string;
  readonly timestamp: string;
}

interface SendMessageBody {
  readonly content: string;
  message_reference?: { readonly message_id: string };
}

export interface MessageSummary {
  readonly id: string;
  readonly channelId: string;
  readonly authorId: string;
  readonly authorUsername: string;
  readonly content: string;
  readonly createdAt: string;
}

export const summarizeMessage = (message: RawMessage): MessageSummary => ({
  id: message.id,
  channelId: message.channel_id,
  authorId: message.author.id,
  authorUsername: message.author.username,
  content: message.content,
  createdAt: message.timestamp,
});

export const readMessages = async (args: ReadMessagesArgs, ctx: CrowContext): Promise<CallToolResult> => {
  const query = {
    limit: args.limit,
    before: args.before,
    after: args.after,
    around: args.around,
  };

  try {
    const messages = await ctx.discord.request<RawMessage[]>(
      'GET',
      `/channels/${args.channelId}/messages`,
      { query },
    );
    return textResult(JSON.stringify(messages.map(summarizeMessage), null, 2));
  } catch (error) {
    return errorResult(toErrorMessage(error));
  }
};

export const sendMessage = async (args: SendMessageArgs, ctx: CrowContext): Promise<CallToolResult> => {
  const body: SendMessageBody = { content: args.content };
  if (args.replyTo) {
    body.message_reference = { message_id: args.replyTo };
  }

  try {
    const message = await ctx.discord.request<RawMessage>(
      'POST',
      `/channels/${args.channelId}/messages`,
      { body },
    );
    return textResult(JSON.stringify(summarizeMessage(message), null, 2));
  } catch (error) {
    return errorResult(toErrorMessage(error));
  }
};

export const registerMessageTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'read_messages',
    {
      description: 'Read recent messages from a Discord channel.',
      inputSchema: readMessagesInput,
    },
    async (args) => readMessages(args, ctx),
  );
  server.registerTool(
    'send_message',
    {
      description: 'Send a message to a Discord channel.',
      inputSchema: sendMessageInput,
    },
    async (args) => sendMessage(args, ctx),
  );
};

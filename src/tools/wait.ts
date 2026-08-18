import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { fetchMessages, summarizeMessage } from './messages.js';
import { errorResult, textResult } from './result.js';
import { snowflake } from './schemas.js';

const waitForMessageInput = z.object({
  channelId: snowflake.describe('The ID of the channel to watch.'),
  after: snowflake
    .optional()
    .describe('Only return messages after this message ID (defaults to the latest message).'),
  userId: snowflake.optional().describe('Only return messages from this user.'),
  timeoutSeconds: z
    .number()
    .int()
    .min(5)
    .max(600)
    .optional()
    .describe('How long to wait before giving up (5-600 seconds, default 120).'),
  pollIntervalSeconds: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .describe('How often to check for new messages (1-30 seconds, default 2).'),
});

export type WaitForMessageArgs = z.infer<typeof waitForMessageInput>;

const DISCORD_EPOCH = 1_420_070_400_000n;

/** A snowflake encoding the current instant (used to seed an empty channel). */
const snowflakeNow = (): string => ((BigInt(Date.now()) - DISCORD_EPOCH) << 22n).toString();

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Blocks until a new message appears in a channel (optionally from a specific
 * user), then returns the new messages. Returns an empty result on timeout.
 */
export const waitForMessage = async (
  args: WaitForMessageArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('wait_for_message', async () => {
    let after = args.after;
    if (after === undefined) {
      const latest = await fetchMessages(args.channelId, { limit: 1 }, ctx);
      after = latest[0]?.id ?? snowflakeNow();
    }

    const timeoutMs = (args.timeoutSeconds ?? 120) * 1_000;
    const pollMs = (args.pollIntervalSeconds ?? 2) * 1_000;
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const messages = await fetchMessages(args.channelId, { after, limit: 100 }, ctx);
      const seen = args.userId ? messages.filter((message) => message.author.id === args.userId) : messages;
      if (seen.length > 0) return seen;
      if (Date.now() >= deadline) return [];
      await sleep(Math.min(pollMs, deadline - Date.now()));
    }
  });

  if (!result.ok) return errorResult(result.error);
  if (result.value.length === 0) {
    return textResult(
      `Timed out after ${args.timeoutSeconds ?? 120}s with no new message in channel ${args.channelId}.`,
    );
  }
  return textResult(JSON.stringify(result.value.map(summarizeMessage), null, 2));
};

export const registerWaitTool = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'wait_for_message',
    {
      title: 'Wait for message',
      description:
        'Block and watch a channel until a new message arrives (optionally from a specific user), then ' +
        'return it. Use this to "listen" in a channel and reply via send_message, waiting again to continue.',
      inputSchema: waitForMessageInput,
      annotations: READ_ONLY,
    },
    async (args) => waitForMessage(args, ctx),
  );
};

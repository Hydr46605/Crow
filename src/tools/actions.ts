import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { actionSchema, type Action } from '../actions/types.js';
import type { CrowContext } from '../context.js';
import { IDEMPOTENT, READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { errorResult, textResult } from './result.js';

export const registerAction = async (
  args: Action,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('register_action', async () => ctx.actions.register(args));
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value, null, 2));
};

export const listActions = async (ctx: CrowContext): Promise<CallToolResult> => {
  const result = await attempt('list_actions', async () => ctx.actions.list());
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value, null, 2));
};

export const removeAction = async (
  args: { readonly customId: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('remove_action', async () => ctx.actions.remove(args.customId));
  if (!result.ok) return errorResult(result.error);
  return textResult(result.value ? `Removed action "${args.customId}".` : `No action registered for "${args.customId}".`);
};

export const listRecentInteractions = async (
  args: { readonly limit?: number },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('list_recent_interactions', async () => {
    const limit = args.limit ?? 50;
    return ctx.actions.listInteractions().slice(0, limit);
  });
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value, null, 2));
};

export const registerActionTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'register_action',
    {
      title: 'Register action',
      description:
        'Register or replace the action fired when a component or modal with the given custom_id is used. ' +
        'Use kind "reply" to answer a click directly, or kind "modal" to open a form and answer its submit. ' +
        'Actions persist across sessions and are dispatched by the gateway runtime.',
      inputSchema: actionSchema,
      annotations: IDEMPOTENT,
    },
    async (args) => registerAction(args, ctx),
  );
  server.registerTool(
    'list_actions',
    {
      title: 'List actions',
      description: 'List every registered component action.',
      annotations: READ_ONLY,
    },
    async () => listActions(ctx),
  );
  server.registerTool(
    'remove_action',
    {
      title: 'Remove action',
      description: 'Remove the registered action for a custom_id.',
      inputSchema: {
        customId: z.string().min(1).max(100).describe('The custom_id whose action to remove.'),
      },
      annotations: IDEMPOTENT,
    },
    async (args) => removeAction(args, ctx),
  );
  server.registerTool(
    'list_recent_interactions',
    {
      title: 'List recent interactions',
      description:
        'List the most recent component and modal interactions, including the values users ' +
        'selected or typed.',
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().describe('Maximum number of interactions (default 50).'),
      },
      annotations: READ_ONLY,
    },
    async (args) => listRecentInteractions(args, ctx),
  );
};

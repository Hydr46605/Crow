import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import type { HttpMethod } from '../discord/client.js';
import { OPEN_WORLD } from './annotations.js';
import { attempt } from './attempt.js';
import { errorResult, textResult } from './result.js';

const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

const rawRequestInput = {
  method: z.enum(httpMethods).describe('The HTTP method for the request.'),
  route: z
    .string()
    .min(1)
    .max(1024)
    .regex(/^\/[^\s]*$/, 'route must start with "/" and contain no whitespace')
    .describe('The Discord API route, e.g. "/channels/{id}/messages".'),
  body: z.unknown().optional().describe('Optional JSON request body.'),
  query: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional()
    .describe('Optional query-string parameters.'),
  reason: z.string().max(512).optional().describe('Optional audit-log reason.'),
};

export interface RawRequestArgs {
  readonly method: HttpMethod;
  readonly route: string;
  readonly body?: unknown;
  readonly query?: Record<string, string | number | boolean>;
  readonly reason?: string;
}

export const rawRequest = async (args: RawRequestArgs, ctx: CrowContext): Promise<CallToolResult> => {
  const result = await attempt('discord_request', () =>
    ctx.discord.request<unknown>(args.method, args.route, {
      body: args.body,
      query: args.query,
      reason: args.reason,
    }),
  );
  if (!result.ok) return errorResult(result.error);

  const response = result.value;
  return textResult(typeof response === 'string' ? response : JSON.stringify(response, null, 2));
};

export const registerRawTool = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'discord_request',
    {
      title: 'Raw Discord request',
      description:
        'Perform an arbitrary Discord REST API request. Use this escape hatch for endpoints ' +
        'the typed tools do not cover. The bot token is never exposed to the caller.',
      inputSchema: rawRequestInput,
      annotations: OPEN_WORLD,
    },
    async (args) => rawRequest(args, ctx),
  );
};

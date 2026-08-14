import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { errorResult, textResult } from './result.js';
import { snowflake } from './schemas.js';

const listAuditLogEntriesInput = {
  guildId: snowflake.describe('The ID of the guild whose audit log to read.'),
  userId: snowflake.optional().describe('Filter entries to those performed by this user.'),
  actionType: z.number().int().optional().describe('Filter by audit-log action type (numeric).'),
  before: snowflake.optional().describe('Return entries before this entry ID.'),
  limit: z.number().int().min(1).max(100).optional().describe('Maximum entries to return (1-100).'),
};

export interface ListAuditLogEntriesArgs {
  readonly guildId: string;
  readonly userId?: string;
  readonly actionType?: number;
  readonly before?: string;
  readonly limit?: number;
}

interface RawAuditEntry {
  readonly id: string;
  readonly user_id: string | null;
  readonly target_id: string | null;
  readonly action_type: number;
  readonly reason?: string | null;
  readonly changes?: readonly unknown[];
}

interface RawAuditLog {
  readonly audit_log_entries: readonly RawAuditEntry[];
}

export interface AuditEntrySummary {
  readonly id: string;
  readonly actionType: number;
  readonly userId: string | null;
  readonly targetId: string | null;
  readonly reason: string | null;
  readonly changes?: readonly unknown[];
}

export const summarizeAuditEntry = (entry: RawAuditEntry): AuditEntrySummary => ({
  id: entry.id,
  actionType: entry.action_type,
  userId: entry.user_id,
  targetId: entry.target_id,
  reason: entry.reason ?? null,
  changes: entry.changes,
});

export const listAuditLogEntries = async (
  args: ListAuditLogEntriesArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('list_audit_log_entries', () =>
    ctx.discord.request<RawAuditLog>('GET', `/guilds/${args.guildId}/audit-logs`, {
      query: {
        user_id: args.userId,
        action_type: args.actionType,
        before: args.before,
        limit: args.limit,
      },
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.audit_log_entries.map(summarizeAuditEntry), null, 2));
};

export const registerAuditLogTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'list_audit_log_entries',
    {
      title: 'List audit log entries',
      description:
        'Read a guild audit log (who changed what), optionally filtered by user or action type. ' +
        'Requires the VIEW_AUDIT_LOG permission.',
      inputSchema: listAuditLogEntriesInput,
      annotations: READ_ONLY,
    },
    async (args) => listAuditLogEntries(args, ctx),
  );
};

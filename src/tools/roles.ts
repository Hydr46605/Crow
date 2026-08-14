import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { DESTRUCTIVE, IDEMPOTENT, READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { requireConsent } from './consent.js';
import { normalizeColor } from './embeds.js';
import { formatPermissions, parsePermissions, permissionName, type PermissionName } from './permissions.js';
import { errorResult, textResult } from './result.js';
import { consent, snowflake } from './schemas.js';

const roleColorSchema = z
  .union([
    z.number().int().min(0).max(0xffffff),
    z.string().regex(/^#?[0-9a-fA-F]{6}$/, 'hex color like #FFAA00'),
  ])
  .describe('Role color as an integer (0-16777215) or a "#RRGGBB" hex string.');

const rolePermissions = z
  .array(permissionName)
  .optional()
  .describe('Permission names to grant (converted to a bitfield).');

const createRoleInput = {
  guildId: snowflake.describe('The ID of the guild to create the role in.'),
  name: z.string().min(1).max(100).optional().describe('Role name (defaults to "new role").'),
  permissions: rolePermissions,
  color: roleColorSchema.optional(),
  hoist: z.boolean().optional().describe('Whether members with this role are displayed separately.'),
  mentionable: z.boolean().optional().describe('Whether anyone can mention this role.'),
  unicodeEmoji: z.string().min(1).max(64).optional().describe('Unicode emoji shown as the role icon.'),
  reason: z.string().max(512).optional().describe('Audit-log reason.'),
};

export const modifyRoleInput = z
  .object({
    guildId: snowflake.describe('The ID of the guild the role belongs to.'),
    roleId: snowflake.describe('The ID of the role to modify.'),
    name: z.string().min(1).max(100).optional().describe('New role name.'),
    permissions: rolePermissions,
    color: roleColorSchema.optional(),
    hoist: z.boolean().optional().describe('Whether members with this role are displayed separately.'),
    mentionable: z.boolean().optional().describe('Whether anyone can mention this role.'),
    unicodeEmoji: z
      .string()
      .min(1)
      .max(64)
      .nullable()
      .optional()
      .describe('Unicode emoji role icon, or null to remove it.'),
    reason: z.string().max(512).optional().describe('Audit-log reason.'),
  })
  .superRefine((args, ctx) => {
    if (
      args.name === undefined &&
      args.permissions === undefined &&
      args.color === undefined &&
      args.hoist === undefined &&
      args.mentionable === undefined &&
      args.unicodeEmoji === undefined
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Provide at least one field to modify.' });
    }
  });

const deleteRoleInput = {
  guildId: snowflake.describe('The ID of the guild the role belongs to.'),
  roleId: snowflake.describe('The ID of the role to delete.'),
  confirm: consent,
  reason: z.string().max(512).optional().describe('Audit-log reason.'),
};

interface RoleFields {
  readonly name?: string;
  readonly permissions?: readonly PermissionName[];
  readonly color?: number | string;
  readonly hoist?: boolean;
  readonly mentionable?: boolean;
  readonly unicodeEmoji?: string | null;
}

export interface ListRolesArgs {
  readonly guildId: string;
}

export interface CreateRoleArgs extends RoleFields {
  readonly guildId: string;
  readonly reason?: string;
}

export interface ModifyRoleArgs extends RoleFields {
  readonly guildId: string;
  readonly roleId: string;
  readonly reason?: string;
}

export interface DeleteRoleArgs {
  readonly guildId: string;
  readonly roleId: string;
  readonly confirm?: true;
  readonly reason?: string;
}

interface RawRole {
  readonly id: string;
  readonly name: string;
  readonly color: number;
  readonly hoist: boolean;
  readonly position: number;
  readonly permissions: string;
  readonly managed: boolean;
  readonly mentionable: boolean;
}

export interface RoleSummary {
  readonly id: string;
  readonly name: string;
  readonly color: number;
  readonly hoist: boolean;
  readonly position: number;
  readonly permissions: PermissionName[];
  readonly managed: boolean;
  readonly mentionable: boolean;
}

export const summarizeRole = (role: RawRole): RoleSummary => ({
  id: role.id,
  name: role.name,
  color: role.color,
  hoist: role.hoist,
  position: role.position,
  permissions: formatPermissions(role.permissions),
  managed: role.managed,
  mentionable: role.mentionable,
});

const roleBody = (args: RoleFields): Record<string, unknown> => {
  const body: Record<string, unknown> = {};
  if (args.name !== undefined) body.name = args.name;
  if (args.permissions !== undefined) body.permissions = parsePermissions(args.permissions);
  if (args.color !== undefined) body.color = normalizeColor(args.color);
  if (args.hoist !== undefined) body.hoist = args.hoist;
  if (args.mentionable !== undefined) body.mentionable = args.mentionable;
  if (args.unicodeEmoji !== undefined) body.unicode_emoji = args.unicodeEmoji;
  return body;
};

export const listRoles = async (args: ListRolesArgs, ctx: CrowContext): Promise<CallToolResult> => {
  const result = await attempt('list_roles', () =>
    ctx.discord.request<RawRole[]>('GET', `/guilds/${args.guildId}/roles`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.map(summarizeRole), null, 2));
};

export const createRole = async (args: CreateRoleArgs, ctx: CrowContext): Promise<CallToolResult> => {
  const result = await attempt('create_role', () =>
    ctx.discord.request<RawRole>('POST', `/guilds/${args.guildId}/roles`, {
      body: roleBody(args),
      reason: args.reason,
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeRole(result.value), null, 2));
};

export const modifyRole = async (args: ModifyRoleArgs, ctx: CrowContext): Promise<CallToolResult> => {
  const result = await attempt('modify_role', () =>
    ctx.discord.request<RawRole>('PATCH', `/guilds/${args.guildId}/roles/${args.roleId}`, {
      body: roleBody(args),
      reason: args.reason,
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeRole(result.value), null, 2));
};

export const deleteRole = async (args: DeleteRoleArgs, ctx: CrowContext): Promise<CallToolResult> => {
  const gate = requireConsent(args.confirm);
  if (gate) return gate;

  const result = await attempt('delete_role', () =>
    ctx.discord.request<unknown>('DELETE', `/guilds/${args.guildId}/roles/${args.roleId}`, {
      reason: args.reason,
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Deleted role ${args.roleId} from guild ${args.guildId}.`);
};

export const registerRoleTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'list_roles',
    {
      title: 'List roles',
      description: 'List the roles in a guild with their permissions and settings.',
      inputSchema: {
        guildId: snowflake.describe('The ID of the guild whose roles to list.'),
      },
      annotations: READ_ONLY,
    },
    async (args) => listRoles(args, ctx),
  );
  server.registerTool(
    'create_role',
    {
      title: 'Create role',
      description:
        'Create a role with a name, permissions (by name), color, and hoist/mentionable flags.',
      inputSchema: createRoleInput,
    },
    async (args) => createRole(args, ctx),
  );
  server.registerTool(
    'modify_role',
    {
      title: 'Modify role',
      description: 'Modify a role: name, permissions, color, hoist, mentionable, or icon.',
      inputSchema: modifyRoleInput,
      annotations: IDEMPOTENT,
    },
    async (args) => modifyRole(args, ctx),
  );
  server.registerTool(
    'delete_role',
    {
      title: 'Delete role',
      description: 'Delete a role from a guild. Requires explicit consent ("confirm": true).',
      inputSchema: deleteRoleInput,
      annotations: DESTRUCTIVE,
    },
    async (args) => deleteRole(args, ctx),
  );
};

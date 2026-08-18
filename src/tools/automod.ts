import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { DESTRUCTIVE, IDEMPOTENT, READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { requireConsent } from './consent.js';
import { errorResult, textResult } from './result.js';
import { consent, snowflake } from './schemas.js';

const TRIGGER_CODES = { keyword: 1, spam: 3, keywordPreset: 4, mentionSpam: 5, memberProfile: 6 } as const;
const TRIGGER_NAMES: Record<number, string> = {
  1: 'keyword',
  3: 'spam',
  4: 'keywordPreset',
  5: 'mentionSpam',
  6: 'memberProfile',
};

const EVENT_CODES = { messageSend: 1, memberUpdate: 2 } as const;
const EVENT_NAMES: Record<number, string> = { 1: 'messageSend', 2: 'memberUpdate' };

const ACTION_CODES = {
  blockMessage: 1,
  sendAlertMessage: 2,
  timeout: 3,
  blockMemberInteraction: 4,
} as const;
const ACTION_NAMES: Record<number, string> = {
  1: 'blockMessage',
  2: 'sendAlertMessage',
  3: 'timeout',
  4: 'blockMemberInteraction',
};

const PRESET_CODES = { profanity: 1, sexualContent: 2, slurs: 3 } as const;
const PRESET_NAMES: Record<number, string> = { 1: 'profanity', 2: 'sexualContent', 3: 'slurs' };

const automodActionSchema = z.object({
  type: z
    .enum(['blockMessage', 'sendAlertMessage', 'timeout', 'blockMemberInteraction'])
    .describe('The action to take when the rule triggers.'),
  customMessage: z
    .string()
    .max(150)
    .optional()
    .describe('Explanation shown to members when blockMessage blocks (blockMessage only).'),
  channelId: snowflake.optional().describe('Channel to log to (sendAlertMessage only).'),
  durationSeconds: z
    .number()
    .int()
    .min(1)
    .max(2419200)
    .optional()
    .describe('Timeout duration in seconds (timeout only, up to 4 weeks).'),
});

const automodRuleInput = z
  .object({
    guildId: snowflake.describe('The ID of the guild.'),
    name: z.string().min(1).max(100).describe('The rule name (1-100 characters).'),
    eventType: z.enum(['messageSend', 'memberUpdate']).describe('The event context the rule checks.'),
    triggerType: z
      .enum(['keyword', 'spam', 'keywordPreset', 'mentionSpam', 'memberProfile'])
      .describe('What kind of content triggers the rule.'),
    keywordFilter: z
      .array(z.string().max(60))
      .max(1000)
      .optional()
      .describe('Keywords to match (keyword or memberProfile, up to 1000).'),
    regexPatterns: z
      .array(z.string().max(260))
      .max(10)
      .optional()
      .describe('Rust-flavored regex patterns to match (keyword or memberProfile, up to 10).'),
    allowList: z
      .array(z.string().max(60))
      .max(1000)
      .optional()
      .describe('Keywords that should not trigger the rule.'),
    presets: z
      .array(z.enum(['profanity', 'sexualContent', 'slurs']))
      .optional()
      .describe('Preset word lists (keywordPreset only).'),
    mentionTotalLimit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe('Max unique mentions allowed (mentionSpam only).'),
    mentionRaidProtectionEnabled: z
      .boolean()
      .optional()
      .describe('Whether to auto-detect mention raids (mentionSpam only).'),
    actions: z.array(automodActionSchema).min(1).max(3).describe('The actions to run when triggered.'),
    enabled: z.boolean().optional().describe('Whether the rule is enabled (default false).'),
    exemptRoles: z.array(snowflake).max(20).optional().describe('Roles exempt from the rule (up to 20).'),
    exemptChannels: z.array(snowflake).max(50).optional().describe('Channels exempt from the rule (up to 50).'),
  })
  .superRefine((args, ctx) => {
    if (args.triggerType === 'keywordPreset' && (args.presets === undefined || args.presets.length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'keywordPreset rules require "presets".' });
    }
  });

const modifyAutomodRuleInput = z
  .object({
    guildId: snowflake.describe('The ID of the guild.'),
    ruleId: snowflake.describe('The ID of the rule to modify.'),
    name: z.string().min(1).max(100).optional().describe('The rule name (1-100 characters).'),
    eventType: z.enum(['messageSend', 'memberUpdate']).optional().describe('The event context the rule checks.'),
    keywordFilter: z.array(z.string().max(60)).max(1000).optional().describe('Keywords to match.'),
    regexPatterns: z.array(z.string().max(260)).max(10).optional().describe('Regex patterns to match.'),
    allowList: z.array(z.string().max(60)).max(1000).optional().describe('Keywords that should not trigger.'),
    presets: z.array(z.enum(['profanity', 'sexualContent', 'slurs'])).optional().describe('Preset word lists.'),
    mentionTotalLimit: z.number().int().min(1).max(50).optional().describe('Max unique mentions allowed.'),
    mentionRaidProtectionEnabled: z.boolean().optional().describe('Whether to auto-detect mention raids.'),
    actions: z.array(automodActionSchema).min(1).max(3).optional().describe('The actions to run when triggered.'),
    enabled: z.boolean().optional().describe('Whether the rule is enabled.'),
    exemptRoles: z.array(snowflake).max(20).optional().describe('Roles exempt from the rule (up to 20).'),
    exemptChannels: z.array(snowflake).max(50).optional().describe('Channels exempt from the rule (up to 50).'),
    reason: z.string().max(512).optional().describe('Audit-log reason.'),
  })
  .superRefine((args, ctx) => {
    if (
      args.name === undefined &&
      args.eventType === undefined &&
      args.keywordFilter === undefined &&
      args.regexPatterns === undefined &&
      args.allowList === undefined &&
      args.presets === undefined &&
      args.mentionTotalLimit === undefined &&
      args.mentionRaidProtectionEnabled === undefined &&
      args.actions === undefined &&
      args.enabled === undefined &&
      args.exemptRoles === undefined &&
      args.exemptChannels === undefined
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Provide at least one field to modify.' });
    }
  });

const deleteAutomodRuleInput = {
  guildId: snowflake.describe('The ID of the guild.'),
  ruleId: snowflake.describe('The ID of the rule to delete.'),
  confirm: consent,
};

export type CreateAutomodRuleArgs = z.infer<typeof automodRuleInput>;
export type ModifyAutomodRuleArgs = z.infer<typeof modifyAutomodRuleInput>;

export interface DeleteAutomodRuleArgs {
  readonly guildId: string;
  readonly ruleId: string;
  readonly confirm?: true;
}

interface RawAutomodRule {
  readonly id: string;
  readonly guild_id: string;
  readonly name: string;
  readonly creator_id: string;
  readonly event_type: number;
  readonly trigger_type: number;
  readonly trigger_metadata?: {
    readonly keyword_filter?: readonly string[];
    readonly regex_patterns?: readonly string[];
    readonly allow_list?: readonly string[];
    readonly presets?: readonly number[];
    readonly mention_total_limit?: number;
    readonly mention_raid_protection_enabled?: boolean;
  };
  readonly actions?: readonly {
    readonly type: number;
    readonly metadata?: {
      readonly custom_message?: string;
      readonly channel_id?: string;
      readonly duration_seconds?: number;
    };
  }[];
  readonly enabled: boolean;
  readonly exempt_roles: readonly string[];
  readonly exempt_channels: readonly string[];
}

const normalizeTriggerMetadata = (
  args: Pick<
    CreateAutomodRuleArgs,
    'keywordFilter' | 'regexPatterns' | 'allowList' | 'presets' | 'mentionTotalLimit' | 'mentionRaidProtectionEnabled'
  >,
): Record<string, unknown> | undefined => {
  const meta: Record<string, unknown> = {};
  if (args.keywordFilter !== undefined) meta.keyword_filter = args.keywordFilter;
  if (args.regexPatterns !== undefined) meta.regex_patterns = args.regexPatterns;
  if (args.allowList !== undefined) meta.allow_list = args.allowList;
  if (args.presets !== undefined) meta.presets = args.presets.map((preset) => PRESET_CODES[preset]);
  if (args.mentionTotalLimit !== undefined) meta.mention_total_limit = args.mentionTotalLimit;
  if (args.mentionRaidProtectionEnabled !== undefined) {
    meta.mention_raid_protection_enabled = args.mentionRaidProtectionEnabled;
  }
  return Object.keys(meta).length > 0 ? meta : undefined;
};

const normalizeActions = (
  actions: readonly { type: keyof typeof ACTION_CODES; customMessage?: string; channelId?: string; durationSeconds?: number }[],
): Record<string, unknown>[] =>
  actions.map((action) => {
    const normalized: Record<string, unknown> = { type: ACTION_CODES[action.type] };
    const metadata: Record<string, unknown> = {};
    if (action.customMessage !== undefined) metadata.custom_message = action.customMessage;
    if (action.channelId !== undefined) metadata.channel_id = action.channelId;
    if (action.durationSeconds !== undefined) metadata.duration_seconds = action.durationSeconds;
    if (Object.keys(metadata).length > 0) normalized.metadata = metadata;
    return normalized;
  });

export const summarizeAutomodRule = (rule: RawAutomodRule): Record<string, unknown> => ({
  id: rule.id,
  guildId: rule.guild_id,
  name: rule.name,
  creatorId: rule.creator_id,
  eventType: EVENT_NAMES[rule.event_type],
  triggerType: TRIGGER_NAMES[rule.trigger_type],
  triggerMetadata: {
    keywordFilter: rule.trigger_metadata?.keyword_filter,
    regexPatterns: rule.trigger_metadata?.regex_patterns,
    allowList: rule.trigger_metadata?.allow_list,
    presets: rule.trigger_metadata?.presets?.map((preset) => PRESET_NAMES[preset]),
    mentionTotalLimit: rule.trigger_metadata?.mention_total_limit,
    mentionRaidProtectionEnabled: rule.trigger_metadata?.mention_raid_protection_enabled,
  },
  actions: (rule.actions ?? []).map((action) => ({
    type: ACTION_NAMES[action.type],
    customMessage: action.metadata?.custom_message,
    channelId: action.metadata?.channel_id,
    durationSeconds: action.metadata?.duration_seconds,
  })),
  enabled: rule.enabled,
  exemptRoles: rule.exempt_roles,
  exemptChannels: rule.exempt_channels,
});

export const listAutomodRules = async (
  args: { readonly guildId: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('list_automod_rules', () =>
    ctx.discord.request<RawAutomodRule[]>('GET', `/guilds/${args.guildId}/auto-moderation/rules`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(result.value.map(summarizeAutomodRule), null, 2));
};

export const getAutomodRule = async (
  args: { readonly guildId: string; readonly ruleId: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('get_automod_rule', () =>
    ctx.discord.request<RawAutomodRule>('GET', `/guilds/${args.guildId}/auto-moderation/rules/${args.ruleId}`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeAutomodRule(result.value), null, 2));
};

export const createAutomodRule = async (
  args: CreateAutomodRuleArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = {
    name: args.name,
    event_type: EVENT_CODES[args.eventType],
    trigger_type: TRIGGER_CODES[args.triggerType],
    actions: normalizeActions(args.actions),
  };
  const metadata = normalizeTriggerMetadata(args);
  if (metadata !== undefined) body.trigger_metadata = metadata;
  if (args.enabled !== undefined) body.enabled = args.enabled;
  if (args.exemptRoles !== undefined) body.exempt_roles = args.exemptRoles;
  if (args.exemptChannels !== undefined) body.exempt_channels = args.exemptChannels;

  const result = await attempt('create_automod_rule', () =>
    ctx.discord.request<RawAutomodRule>('POST', `/guilds/${args.guildId}/auto-moderation/rules`, { body }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeAutomodRule(result.value), null, 2));
};

export const modifyAutomodRule = async (
  args: ModifyAutomodRuleArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = {};
  if (args.name !== undefined) body.name = args.name;
  if (args.eventType !== undefined) body.event_type = EVENT_CODES[args.eventType];
  const metadata = normalizeTriggerMetadata(args);
  if (metadata !== undefined) body.trigger_metadata = metadata;
  if (args.actions !== undefined) body.actions = normalizeActions(args.actions);
  if (args.enabled !== undefined) body.enabled = args.enabled;
  if (args.exemptRoles !== undefined) body.exempt_roles = args.exemptRoles;
  if (args.exemptChannels !== undefined) body.exempt_channels = args.exemptChannels;

  const result = await attempt('modify_automod_rule', () =>
    ctx.discord.request<RawAutomodRule>('PATCH', `/guilds/${args.guildId}/auto-moderation/rules/${args.ruleId}`, {
      body,
      reason: args.reason,
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeAutomodRule(result.value), null, 2));
};

export const deleteAutomodRule = async (
  args: DeleteAutomodRuleArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const gate = requireConsent(args.confirm);
  if (gate) return gate;

  const result = await attempt('delete_automod_rule', () =>
    ctx.discord.request<unknown>('DELETE', `/guilds/${args.guildId}/auto-moderation/rules/${args.ruleId}`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(`Deleted automod rule ${args.ruleId} from guild ${args.guildId}.`);
};

export const registerAutomodTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'list_automod_rules',
    {
      title: 'List automod rules',
      description: 'List the auto-moderation rules configured for a guild.',
      inputSchema: { guildId: snowflake.describe('The ID of the guild.') },
      annotations: READ_ONLY,
    },
    async (args) => listAutomodRules(args, ctx),
  );
  server.registerTool(
    'get_automod_rule',
    {
      title: 'Get automod rule',
      description: 'Get a single auto-moderation rule by ID.',
      inputSchema: {
        guildId: snowflake.describe('The ID of the guild.'),
        ruleId: snowflake.describe('The ID of the rule.'),
      },
      annotations: READ_ONLY,
    },
    async (args) => getAutomodRule(args, ctx),
  );
  server.registerTool(
    'create_automod_rule',
    {
      title: 'Create automod rule',
      description: 'Create an auto-moderation rule with trigger conditions and actions.',
      inputSchema: automodRuleInput,
    },
    async (args) => createAutomodRule(args, ctx),
  );
  server.registerTool(
    'modify_automod_rule',
    {
      title: 'Modify automod rule',
      description: 'Modify an auto-moderation rule: name, conditions, actions, and exemptions.',
      inputSchema: modifyAutomodRuleInput,
      annotations: IDEMPOTENT,
    },
    async (args) => modifyAutomodRule(args, ctx),
  );
  server.registerTool(
    'delete_automod_rule',
    {
      title: 'Delete automod rule',
      description: 'Delete an auto-moderation rule. Requires explicit consent ("confirm": true).',
      inputSchema: deleteAutomodRuleInput,
      annotations: DESTRUCTIVE,
    },
    async (args) => deleteAutomodRule(args, ctx),
  );
};

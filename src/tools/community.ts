import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CrowContext } from '../context.js';
import { IDEMPOTENT, READ_ONLY } from './annotations.js';
import { attempt } from './attempt.js';
import { errorResult, textResult } from './result.js';
import { snowflake } from './schemas.js';

/* -------------------------------------------------------------------------- */
/* Welcome screen                                                              */
/* -------------------------------------------------------------------------- */

const welcomeChannelSchema = z.object({
  channelId: snowflake.describe('The ID of the welcome channel.'),
  description: z.string().max(100).optional().describe('Short description shown under the channel.'),
  emojiId: snowflake.optional().describe('Custom emoji ID for the channel.'),
  emojiName: z.string().min(1).max(64).optional().describe('Unicode emoji character for the channel.'),
});

const modifyWelcomeScreenInput = z
  .object({
    guildId: snowflake.describe('The ID of the guild.'),
    enabled: z.boolean().optional().describe('Whether the welcome screen is enabled.'),
    description: z.string().max(1000).optional().describe('The welcome screen description.'),
    welcomeChannels: z
      .array(welcomeChannelSchema)
      .optional()
      .describe('The channels shown on the welcome screen.'),
  })
  .superRefine((args, ctx) => {
    if (args.enabled === undefined && args.description === undefined && args.welcomeChannels === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one of "enabled", "description", or "welcomeChannels".',
      });
    }
  });

export type ModifyWelcomeScreenArgs = z.infer<typeof modifyWelcomeScreenInput>;

interface RawWelcomeScreen {
  readonly enabled?: boolean;
  readonly description?: string | null;
  readonly welcome_channels?: {
    readonly channel_id: string;
    readonly description: string;
    readonly emoji_id?: string | null;
    readonly emoji_name?: string | null;
  }[];
}

export const summarizeWelcomeScreen = (screen: RawWelcomeScreen): Record<string, unknown> => ({
  enabled: screen.enabled,
  description: screen.description,
  welcomeChannels: (screen.welcome_channels ?? []).map((channel) => ({
    channelId: channel.channel_id,
    description: channel.description,
    emojiId: channel.emoji_id,
    emojiName: channel.emoji_name,
  })),
});

export const getWelcomeScreen = async (
  args: { readonly guildId: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('get_welcome_screen', () =>
    ctx.discord.request<RawWelcomeScreen>('GET', `/guilds/${args.guildId}/welcome-screen`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeWelcomeScreen(result.value), null, 2));
};

export const modifyWelcomeScreen = async (
  args: ModifyWelcomeScreenArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = {};
  if (args.enabled !== undefined) body.enabled = args.enabled;
  if (args.description !== undefined) body.description = args.description;
  if (args.welcomeChannels !== undefined) {
    body.welcome_channels = args.welcomeChannels.map((channel) => ({
      channel_id: channel.channelId,
      description: channel.description,
      emoji_id: channel.emojiId,
      emoji_name: channel.emojiName,
    }));
  }

  const result = await attempt('modify_welcome_screen', () =>
    ctx.discord.request<RawWelcomeScreen>('PATCH', `/guilds/${args.guildId}/welcome-screen`, { body }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeWelcomeScreen(result.value), null, 2));
};

/* -------------------------------------------------------------------------- */
/* Onboarding                                                                  */
/* -------------------------------------------------------------------------- */

const onboardingOptionSchema = z.object({
  id: snowflake.describe('The ID of this option.'),
  title: z.string().min(1).max(100).describe('Option title (1-100 characters).'),
  description: z.string().min(1).max(100).optional().describe('Optional option description.'),
  channelIds: z.array(snowflake).optional().describe('Channels granted by this option.'),
  roleIds: z.array(snowflake).optional().describe('Roles granted by this option.'),
  emojiName: z.string().min(1).max(64).optional().describe('Unicode emoji character for the option.'),
  emojiId: snowflake.optional().describe('Custom emoji ID for the option.'),
});

const onboardingPromptSchema = z.object({
  id: snowflake.describe('The ID of this prompt.'),
  title: z.string().min(1).max(100).describe('Prompt title (1-100 characters).'),
  type: z
    .enum(['multipleChoice', 'dropdown'])
    .optional()
    .describe('Prompt type (multiple choice or dropdown).'),
  singleSelect: z.boolean().optional().describe('Whether only one option can be selected.'),
  required: z.boolean().optional().describe('Whether the prompt must be answered.'),
  inOnboarding: z.boolean().optional().describe('Whether the prompt is shown during onboarding.'),
  options: z.array(onboardingOptionSchema).min(1).describe('The selectable options.'),
});

const modifyOnboardingInput = z
  .object({
    guildId: snowflake.describe('The ID of the guild.'),
    enabled: z.boolean().optional().describe('Whether onboarding is enabled.'),
    mode: z
      .enum(['default', 'advanced'])
      .optional()
      .describe('Onboarding mode: default or advanced (custom prompts).'),
    prompts: z.array(onboardingPromptSchema).optional().describe('The custom onboarding prompts.'),
    defaultChannels: z
      .array(snowflake)
      .optional()
      .describe('Channels a member joins by default.'),
  })
  .superRefine((args, ctx) => {
    if (
      args.enabled === undefined &&
      args.mode === undefined &&
      args.prompts === undefined &&
      args.defaultChannels === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one of "enabled", "mode", "prompts", or "defaultChannels".',
      });
    }
  });

export type ModifyOnboardingArgs = z.infer<typeof modifyOnboardingInput>;

interface RawOnboardingOption {
  readonly id: string;
  readonly channel_ids: string[];
  readonly role_ids: string[];
  readonly emoji?: { readonly name?: string | null; readonly id?: string | null } | null;
  readonly title: string;
  readonly description?: string | null;
}

interface RawOnboardingPrompt {
  readonly id: string;
  readonly type: number;
  readonly options: RawOnboardingOption[];
  readonly title: string;
  readonly single_select: boolean;
  readonly required: boolean;
  readonly in_onboarding: boolean;
}

interface RawOnboarding {
  readonly guild_id: string;
  readonly prompts: RawOnboardingPrompt[];
  readonly default_channel_ids: string[];
  readonly enabled: boolean;
  readonly mode: number;
}

export const summarizeOnboarding = (onboarding: RawOnboarding): Record<string, unknown> => ({
  guildId: onboarding.guild_id,
  enabled: onboarding.enabled,
  mode: onboarding.mode === 1 ? 'advanced' : 'default',
  defaultChannels: onboarding.default_channel_ids,
  prompts: onboarding.prompts.map((prompt) => ({
    id: prompt.id,
    title: prompt.title,
    type: prompt.type === 1 ? 'dropdown' : 'multipleChoice',
    singleSelect: prompt.single_select,
    required: prompt.required,
    inOnboarding: prompt.in_onboarding,
    options: prompt.options.map((option) => ({
      id: option.id,
      title: option.title,
      description: option.description,
      channelIds: option.channel_ids,
      roleIds: option.role_ids,
      emojiName: option.emoji?.name ?? null,
      emojiId: option.emoji?.id ?? null,
    })),
  })),
});

export const getOnboarding = async (
  args: { readonly guildId: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('get_onboarding', () =>
    ctx.discord.request<RawOnboarding>('GET', `/guilds/${args.guildId}/onboarding`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeOnboarding(result.value), null, 2));
};

export const modifyOnboarding = async (
  args: ModifyOnboardingArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = {};
  if (args.enabled !== undefined) body.enabled = args.enabled;
  if (args.mode !== undefined) body.mode = args.mode === 'advanced' ? 1 : 0;
  if (args.defaultChannels !== undefined) body.default_channel_ids = args.defaultChannels;
  if (args.prompts !== undefined) {
    body.prompts = args.prompts.map((prompt) => ({
      id: prompt.id,
      title: prompt.title,
      type: prompt.type === 'dropdown' ? 1 : 0,
      single_select: prompt.singleSelect,
      required: prompt.required,
      in_onboarding: prompt.inOnboarding,
      options: prompt.options.map((option) => ({
        id: option.id,
        title: option.title,
        description: option.description,
        channel_ids: option.channelIds,
        role_ids: option.roleIds,
        emoji: option.emojiName || option.emojiId ? { name: option.emojiName, id: option.emojiId } : undefined,
      })),
    }));
  }

  const result = await attempt('modify_onboarding', () =>
    ctx.discord.request<RawOnboarding>('PUT', `/guilds/${args.guildId}/onboarding`, { body }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeOnboarding(result.value), null, 2));
};

/* -------------------------------------------------------------------------- */
/* Member verification (membership screening)                                  */
/* -------------------------------------------------------------------------- */

const verificationFieldSchema = z.object({
  fieldType: z
    .enum(['terms', 'multipleChoice'])
    .describe('Verification field type: terms or multiple choice.'),
  label: z.string().min(1).max(150).describe('The field label (1-150 characters).'),
  required: z.boolean().optional().describe('Whether the field is required.'),
  values: z
    .array(z.string().min(1).max(150))
    .optional()
    .describe('Choices for multipleChoice fields.'),
});

const modifyMemberVerificationInput = z
  .object({
    guildId: snowflake.describe('The ID of the guild.'),
    enabled: z.boolean().optional().describe('Whether membership screening is enabled.'),
    description: z.string().max(1000).optional().describe('The screening description shown to new members.'),
    formFields: z.array(verificationFieldSchema).optional().describe('The screening form fields.'),
  })
  .superRefine((args, ctx) => {
    if (args.enabled === undefined && args.description === undefined && args.formFields === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one of "enabled", "description", or "formFields".',
      });
    }
  });

export type ModifyMemberVerificationArgs = z.infer<typeof modifyMemberVerificationInput>;

interface RawVerificationField {
  readonly field_type: string;
  readonly label: string;
  readonly required: boolean;
  readonly values?: string[];
}

interface RawMemberVerification {
  readonly enabled: boolean;
  readonly description?: string | null;
  readonly form_fields: RawVerificationField[];
}

export const summarizeMemberVerification = (
  verification: RawMemberVerification,
): Record<string, unknown> => ({
  enabled: verification.enabled,
  description: verification.description,
  formFields: (verification.form_fields ?? []).map((field) => ({
    fieldType: field.field_type === 'MULTIPLE_CHOICE' ? 'multipleChoice' : 'terms',
    label: field.label,
    required: field.required,
    values: field.values,
  })),
});

export const getMemberVerification = async (
  args: { readonly guildId: string },
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const result = await attempt('get_member_verification', () =>
    ctx.discord.request<RawMemberVerification>('GET', `/guilds/${args.guildId}/member-verification`),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeMemberVerification(result.value), null, 2));
};

export const modifyMemberVerification = async (
  args: ModifyMemberVerificationArgs,
  ctx: CrowContext,
): Promise<CallToolResult> => {
  const body: Record<string, unknown> = {};
  if (args.enabled !== undefined) body.enabled = args.enabled;
  if (args.description !== undefined) body.description = args.description;
  if (args.formFields !== undefined) {
    body.form_fields = args.formFields.map((field) => ({
      field_type: field.fieldType === 'multipleChoice' ? 'MULTIPLE_CHOICE' : 'TERMS',
      label: field.label,
      required: field.required,
      values: field.values,
    }));
  }

  const result = await attempt('modify_member_verification', () =>
    ctx.discord.request<RawMemberVerification>('PATCH', `/guilds/${args.guildId}/member-verification`, {
      body,
    }),
  );
  if (!result.ok) return errorResult(result.error);
  return textResult(JSON.stringify(summarizeMemberVerification(result.value), null, 2));
};

/* -------------------------------------------------------------------------- */
/* Registration                                                                */
/* -------------------------------------------------------------------------- */

export const registerCommunityTools = (server: McpServer, ctx: CrowContext): void => {
  server.registerTool(
    'get_welcome_screen',
    {
      title: 'Get welcome screen',
      description: "Get a guild's welcome screen configuration.",
      inputSchema: { guildId: snowflake.describe('The ID of the guild.') },
      annotations: READ_ONLY,
    },
    async (args) => getWelcomeScreen(args, ctx),
  );
  server.registerTool(
    'modify_welcome_screen',
    {
      title: 'Modify welcome screen',
      description: "Modify a guild's welcome screen: enabled, description, and welcome channels.",
      inputSchema: modifyWelcomeScreenInput,
      annotations: IDEMPOTENT,
    },
    async (args) => modifyWelcomeScreen(args, ctx),
  );
  server.registerTool(
    'get_onboarding',
    {
      title: 'Get onboarding',
      description: "Get a guild's onboarding configuration (prompts and default channels).",
      inputSchema: { guildId: snowflake.describe('The ID of the guild.') },
      annotations: READ_ONLY,
    },
    async (args) => getOnboarding(args, ctx),
  );
  server.registerTool(
    'modify_onboarding',
    {
      title: 'Modify onboarding',
      description:
        "Modify a guild's onboarding: enabled, mode, custom prompts, and default channels.",
      inputSchema: modifyOnboardingInput,
      annotations: IDEMPOTENT,
    },
    async (args) => modifyOnboarding(args, ctx),
  );
  server.registerTool(
    'get_member_verification',
    {
      title: 'Get member verification',
      description: "Get a guild's membership screening (member verification) configuration.",
      inputSchema: { guildId: snowflake.describe('The ID of the guild.') },
      annotations: READ_ONLY,
    },
    async (args) => getMemberVerification(args, ctx),
  );
  server.registerTool(
    'modify_member_verification',
    {
      title: 'Modify member verification',
      description:
        "Modify a guild's membership screening: enabled, description, and form fields.",
      inputSchema: modifyMemberVerificationInput,
      annotations: IDEMPOTENT,
    },
    async (args) => modifyMemberVerification(args, ctx),
  );
};

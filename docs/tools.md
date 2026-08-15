# Tools

Crow exposes Discord capabilities as MCP tools. Every tool is a self-contained module under
`src/tools/` and registers itself through the shared registry in `src/tools/index.ts`.

## Convention

A tool module exports:

1. Pure handlers: the business logic, unit-testable without the MCP layer.
2. `register<Name>Tool(s)(server, ctx)` functions that bind the handlers to the MCP server with a
   Zod input schema.

`ctx` is the shared `CrowContext` (`config`, `discord` REST client, and `actions` runtime) handed to
every handler.
All Discord HTTP flows through the single `DiscordClient`, which adds auth, rate limiting, and
token redaction on errors. Handlers normalize errors with the `attempt` helper.

Shared building blocks live alongside the tools:

- `embeds.ts`: validated embed schema + normalization (with Discord's limits enforced).
- `components.ts`: message-component schemas (buttons, selects, action rows) + normalization.
- `permissions.ts`: named Discord permission to bitfield conversion.
- `channel-types.ts`: channel type codes and friendly names.
- `files.ts`: file-source resolution (path/url/data) with size limits and content-type inference.
- `actions/`: the action registry plus the pure `resolveInteraction` hook.
- `gateway/`: the Gateway connection (heartbeat, resume, reconnect) and the interaction daemon.

## Selection pipeline

Most actions are per-guild, so a typical flow is:

1. `list_guilds` → pick a guild.
2. `get_guild` / `list_channels` → confirm guild and channel details.
3. `list_members` / `get_member` → pick a user.
4. Act (`read_messages`, `send_message`, `kick_member`, `modify_channel`, …).

## Embeds and components

`send_message`, `edit_message`, and `execute_webhook` accept `embeds` and `components` directly.
`create_embed` validates an embed locally and returns the exact JSON Discord expects, so an agent
can check limits before sending.

`send_message` and `edit_message` also accept `attachments` (files, images, GIFs) resolved from a
local path, a URL, or inline base64/data-URI data.

Components (buttons, string/user/role/mentionable/channel select menus) can be attached to messages.
Run `crow gateway` to connect to the Gateway and receive the resulting interactions live: the actions
runtime maps a component's `custom_id` to a reply or a modal, and Crow answers with the matching
callback. Modal actions open a form (up to 5 text inputs) and reply when it is submitted. The
values users submit (selected menu options and modal inputs) are logged and readable via
`list_recent_interactions`, and replies can reference them with `{values}`, `{values.N}`, and
`{input.<customId>}` placeholders.

## Consent model

Destructive tools require an explicit `"confirm": true` argument. Without it they return an error
and take no action. This applies to `kick_member`, `ban_member`, `delete_channel`, `delete_message`,
`delete_webhook`, `delete_invite`, `delete_emoji`, `delete_sticker`, `delete_role`, and
`bulk_delete_messages`.

## Annotations

Every tool carries MCP annotations so clients can reason about safety without reading source:

- Read-only tools (`list_*`, `get_*`, `read_messages`, `ping`, `create_embed`, `list_actions`)
  set `readOnlyHint`.
- Destructive tools (`kick_member`, `ban_member`, `delete_channel`, `delete_message`,
  `delete_webhook`, `delete_invite`, `delete_emoji`, `delete_sticker`, `delete_role`,
  `bulk_delete_messages`) set `destructiveHint`.
- Idempotent writes (`edit_message`, `modify_channel`, `modify_thread`, `modify_guild`,
  `modify_webhook`, `modify_emoji`, `modify_sticker`, `edit_channel_permissions`, `modify_role`,
  `modify_member`, `modify_current_user`, `modify_welcome_screen`, `modify_onboarding`,
  `modify_member_verification`, `add_role_to_member`, `remove_role_from_member`, `add_reaction`,
  `remove_own_reaction`, `remove_user_reaction`, `pin_message`, `unpin_message`, `unban_member`,
  `register_action`, `remove_action`) set `idempotentHint`.
- `discord_request` sets `openWorldHint` because it can reach any endpoint.

Each tool also has a human-readable `title` and per-field descriptions in its input schema.

## Tool reference

### Health
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `ping` | `message?` | Health check that responds with `pong`. |

### Discovery
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `list_guilds` | | List the guilds the bot is a member of. |
| `get_guild` | `guildId` | Get details for a single guild. |
| `list_members` | `guildId`, `query?`, `limit?`, `after?` | List guild members (optionally by username search). |
| `get_member` | `guildId`, `userId` | Get a single guild member. |
| `list_channels` | `guildId` | List the channels in a guild. |
| `get_channel` | `channelId` | Get a single channel by ID, with settings and overwrites. |

### Messaging & embeds
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `read_messages` | `channelId`, `limit?`, `before?`, `after?`, `around?` | Read recent channel messages. |
| `send_message` | `channelId`, `content?`, `embeds?`, `components?`, `attachments?`, `allowedMentions?`, `tts?`, `replyTo?` | Send a channel message. |
| `edit_message` | `channelId`, `messageId`, `content?`, `embeds?`, `components?`, `attachments?` | Edit a message. |
| `delete_message` | `channelId`, `messageId`, `confirm` | Delete a message (consent-gated). |
| `pin_message` | `channelId`, `messageId` | Pin a message in a channel. |
| `unpin_message` | `channelId`, `messageId` | Unpin a message in a channel. |
| `bulk_delete_messages` | `channelId`, `messageIds`, `confirm` | Delete up to 100 messages at once (consent-gated). |
| `create_embed` | `embed` | Validate an embed and return its Discord JSON. |

### Direct messages
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `list_dm_channels` | | List the bot's DM channels and their recipients. |
| `get_dm_channel` | `userId` | Resolve (or create) the DM channel with a user. |
| `send_dm` | `userId`, `content?`, `embeds?`, `components?`, `attachments?`, `allowedMentions?`, `tts?` | Send a DM to a user (creates the DM channel if needed). |
| `read_dm_messages` | `userId` or `channelId`, `limit?`, `before?`, `after?`, `around?` | Read the message history of a DM. |

### Channels & threads
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `modify_channel` | `channelId`, `name?`, `topic?`, `nsfw?`, `slowmodeSeconds?`, `position?`, `bitrate?`, `userLimit?`, `rtcRegion?`, `videoQualityMode?`, `defaultAutoArchiveDuration?`, `defaultThreadRateLimitPerUser?`, `availableTags?`, `defaultReactionEmoji?`, `defaultSortOrder?`, `defaultForumLayout?`, `permissionOverwrites?` | Modify a channel (text, voice, forum, overwrites). |
| `create_channel` | `guildId`, `name`, `type?`, plus the voice/forum/overwrite fields above | Create a channel. |
| `delete_channel` | `channelId`, `confirm` | Delete a channel (consent-gated). |
| `list_active_threads` | `channelId` | List a channel's active threads. |
| `list_archived_threads` | `channelId` | List a channel's archived public threads (forum posts). |
| `create_thread` | `channelId`, `name`, `messageId?`, `type?`, `autoArchiveDuration?`, `rateLimitPerUser?`, `message?`, `appliedTags?` | Create a thread, start one from a message, or create a forum post. |
| `modify_thread` | `threadId`, `name?`, `archived?`, `locked?`, `autoArchiveDuration?`, `rateLimitPerUser?`, `appliedTags?` | Modify a thread. |
| `edit_channel_permissions` | `channelId`, `overwriteId`, `type`, `allow?`, `deny?` | Set a role/member permission overwrite (named permissions). |
| `delete_channel_permissions` | `channelId`, `overwriteId` | Remove a role/member permission overwrite. |
| `modify_guild` | `guildId`, `name?`, `description?`, `rulesChannelId?` | Modify guild name, description, rules channel. |

### Webhooks
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `list_webhooks` | `channelId` | List a channel's webhooks (includes tokens). |
| `get_webhook` | `webhookId` | Get a webhook by ID (includes its token). |
| `create_webhook` | `channelId`, `name`, `avatar?` | Create a webhook in a channel. |
| `modify_webhook` | `webhookId`, `name?`, `avatar?`, `channelId?` | Modify a webhook. |
| `delete_webhook` | `webhookId`, `confirm` | Delete a webhook (consent-gated). |
| `execute_webhook` | `webhookId`, `webhookToken`, `content?`, `embeds?`, `components?`, `username?`, `avatarUrl?`, `tts?`, `allowedMentions?`, `threadId?`, `wait?` | Send a message through a webhook token. |

### Invites
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `list_guild_invites` | `guildId` | List a guild's invites. |
| `list_channel_invites` | `channelId` | List a channel's invites. |
| `get_invite` | `code`, `withCounts?`, `withExpiration?` | Get invite metadata by code or URL. |
| `get_vanity_url` | `guildId` | Get a guild's vanity URL, if any. |
| `create_invite` | `channelId`, `maxAge?`, `maxUses?`, `temporary?`, `unique?`, `targetType?`, `targetUserId?`, `targetApplicationId?`, `reason?` | Create an invite. |
| `delete_invite` | `code`, `confirm` | Delete an invite (consent-gated). |

### Emojis
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `list_emojis` | `guildId` | List a guild's custom emojis. |
| `get_emoji` | `guildId`, `emojiId` | Get a single emoji. |
| `create_emoji` | `guildId`, `name`, `image`, `roles?`, `reason?` | Create an emoji from a data URI or file source. |
| `modify_emoji` | `guildId`, `emojiId`, `name?`, `roles?`, `reason?` | Modify an emoji. |
| `delete_emoji` | `guildId`, `emojiId`, `confirm`, `reason?` | Delete an emoji (consent-gated). |

### Stickers
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `list_stickers` | `guildId` | List a guild's stickers. |
| `get_sticker` | `guildId`, `stickerId` | Get a single sticker. |
| `list_sticker_packs` | | List available sticker packs. |
| `get_sticker_pack` | `packId` | Get a sticker pack. |
| `create_sticker` | `guildId`, `name`, `description?`, `tags`, `file`, `reason?` | Create a sticker from a file. |
| `modify_sticker` | `guildId`, `stickerId`, `name?`, `description?`, `tags?`, `reason?` | Modify a sticker. |
| `delete_sticker` | `guildId`, `stickerId`, `confirm`, `reason?` | Delete a sticker (consent-gated). |

### Roles
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `list_roles` | `guildId` | List a guild's roles with permissions and settings. |
| `create_role` | `guildId`, `name?`, `permissions?`, `color?`, `hoist?`, `mentionable?`, `unicodeEmoji?`, `reason?` | Create a role. |
| `modify_role` | `guildId`, `roleId`, `name?`, `permissions?`, `color?`, `hoist?`, `mentionable?`, `unicodeEmoji?`, `reason?` | Modify a role. |
| `delete_role` | `guildId`, `roleId`, `confirm`, `reason?` | Delete a role (consent-gated). |

### Member management
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `modify_member` | `guildId`, `userId`, `nick?`, `mute?`, `deaf?`, `channelId?`, `timeoutUntil?`, `reason?` | Modify a member (nickname, voice, timeout). |
| `add_role_to_member` | `guildId`, `userId`, `roleId` | Assign a role to a member. |
| `remove_role_from_member` | `guildId`, `userId`, `roleId` | Remove a role from a member. |

### Self
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `get_current_user` | | Get the bot's own profile (username, avatar, banner, bio). |
| `modify_current_user` | `username?`, `avatar?`, `banner?`, `bio?` | Modify the bot's own profile (avatar/banner accept a data URI or file source). |

### Reactions
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `add_reaction` | `channelId`, `messageId`, `emoji` | React to a message as the bot. |
| `remove_own_reaction` | `channelId`, `messageId`, `emoji` | Remove the bot's own reaction. |
| `remove_user_reaction` | `channelId`, `messageId`, `emoji`, `userId` | Remove another user's reaction. |
| `list_reactions` | `channelId`, `messageId`, `emoji`, `limit?`, `after?` | List the users who reacted with an emoji. |

### Audit
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `list_audit_log_entries` | `guildId`, `userId?`, `actionType?`, `before?`, `limit?` | Read the guild audit log. |

### Community
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `get_welcome_screen` | `guildId` | Get a guild's welcome screen. |
| `modify_welcome_screen` | `guildId`, `enabled?`, `description?`, `welcomeChannels?` | Modify a guild's welcome screen. |
| `get_onboarding` | `guildId` | Get a guild's onboarding (prompts + default channels). |
| `modify_onboarding` | `guildId`, `enabled?`, `mode?`, `prompts?`, `defaultChannels?` | Modify a guild's onboarding. |
| `get_member_verification` | `guildId` | Get a guild's membership screening. |
| `modify_member_verification` | `guildId`, `enabled?`, `description?`, `formFields?` | Modify a guild's membership screening. |

### Actions
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `register_action` | `kind?` (`reply` default, or `modal`), `customId`, `content?`, `embeds?`, `ephemeral?`, plus `title`, `inputs`, `submitCustomId` for modals | Register or replace a reply or modal action. |
| `list_actions` | | List registered actions. |
| `remove_action` | `customId` | Remove a registered action. |
| `list_recent_interactions` | `limit?` | List recent component/modal interactions and the values users submitted. |

### Moderation
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `list_bans` | `guildId`, `limit?` | List guild bans. |
| `get_ban` | `guildId`, `userId` | Get a single ban. |
| `kick_member` | `guildId`, `userId`, `confirm`, `reason?` | Kick a member (consent-gated). |
| `ban_member` | `guildId`, `userId`, `confirm`, `deleteMessageDays?`, `reason?` | Ban a member (consent-gated). |
| `unban_member` | `guildId`, `userId`, `reason?` | Remove a ban. |

### Raw
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `discord_request` | `method`, `route`, `body?`, `query?`, `reason?` | Arbitrary Discord REST call. |

> `list_members` may require the `GUILD_MEMBERS` privileged intent to be enabled for the bot in the
> Discord Developer Portal.

## Roadmap

| Module | Status | Purpose |
| --- | --- | --- |
| `embeds` | done | Create rich embeds. |
| `components` | send-only | Build messages with buttons and select menus. |
| `webhooks` | done | Manage and execute webhooks. |
| `attachments` | done | Send files, images, and GIFs on messages. |
| `invites` | done | Manage invites and vanity URLs. |
| `emojis` | done | Manage custom emojis. |
| `stickers` | done | Manage guild stickers and packs. |
| `interactions` | done | Action registry, modal actions, and the Gateway transport. |
| `roles` | done | Manage roles and member role assignment. |
| `reactions` | done | Add and remove message reactions. |
| `audit` | done | Read the guild audit log. |
| `dms` | done | List, send, and read direct messages. |
| `self` | done | Read and modify the bot's own profile. |
| `community` | done | Manage the welcome screen, onboarding, and membership screening. |
| `interaction-values` | done | Capture and substitute submitted select/modal values. |

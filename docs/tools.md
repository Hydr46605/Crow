# Tools

Crow exposes Discord capabilities as MCP tools. Every tool is a self-contained module under
`src/tools/` and registers itself through the shared registry in `src/tools/index.ts`.

## Convention

A tool module exports:

1. Pure handlers — the business logic, unit-testable without the MCP layer.
2. `register<Name>Tool(s)(server, ctx)` functions that bind the handlers to the MCP server with a
   Zod input schema.

`ctx` is the shared `CrowContext` (`config` + `discord` REST client) handed to every handler.
All Discord HTTP flows through the single `DiscordClient`, which adds auth, rate limiting, and
token redaction on errors. Handlers normalize errors with the `attempt` helper.

Shared building blocks live alongside the tools:

- `embeds.ts` — validated embed schema + normalization (with Discord's limits enforced).
- `components.ts` — message-component schemas (buttons, selects, action rows) + normalization.
- `permissions.ts` — named Discord permission ↔ bitfield conversion.
- `channel-types.ts` — channel type codes and friendly names.

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

Components (buttons, string/user/role/mentionable/channel select menus) are **send-only** in 0.5.0:
Crow builds and attaches them, but does not yet receive the resulting interactions. A future runtime
will let the agent register handlers for `custom_id` values.

## Consent model

Destructive tools require an explicit `"confirm": true` argument. Without it they return an error
and take no action. This applies to `kick_member`, `ban_member`, `delete_channel`,
`delete_message`, and `delete_webhook`.

## Annotations

Every tool carries MCP annotations so clients can reason about safety without reading source:

- Read-only tools (`list_*`, `get_*`, `read_messages`, `ping`, `create_embed`) set `readOnlyHint`.
- Destructive tools (`kick_member`, `ban_member`, `delete_channel`, `delete_message`,
  `delete_webhook`) set `destructiveHint`.
- Idempotent writes (`edit_message`, `modify_channel`, `modify_thread`, `modify_guild`,
  `modify_webhook`, `edit_channel_permissions`, `unban_member`) set `idempotentHint`.
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
| `list_guilds` | — | List the guilds the bot is a member of. |
| `get_guild` | `guildId` | Get details for a single guild. |
| `list_members` | `guildId`, `query?`, `limit?`, `after?` | List guild members (optionally by username search). |
| `get_member` | `guildId`, `userId` | Get a single guild member. |
| `list_channels` | `guildId` | List the channels in a guild. |
| `get_channel` | `channelId` | Get a single channel by ID, with settings and overwrites. |

### Messaging & embeds
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `read_messages` | `channelId`, `limit?`, `before?`, `after?`, `around?` | Read recent channel messages. |
| `send_message` | `channelId`, `content?`, `embeds?`, `components?`, `allowedMentions?`, `tts?`, `replyTo?` | Send a channel message. |
| `edit_message` | `channelId`, `messageId`, `content?`, `embeds?`, `components?` | Edit a message. |
| `delete_message` | `channelId`, `messageId`, `confirm` | Delete a message (consent-gated). |
| `create_embed` | `embed` | Validate an embed and return its Discord JSON. |

### Channels & threads
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `modify_channel` | `channelId`, `name?`, `topic?`, `nsfw?`, `slowmodeSeconds?`, `position?`, `bitrate?`, `userLimit?`, `rtcRegion?`, `videoQualityMode?`, `defaultAutoArchiveDuration?`, `defaultThreadRateLimitPerUser?`, `availableTags?`, `defaultReactionEmoji?`, `defaultSortOrder?`, `defaultForumLayout?`, `permissionOverwrites?` | Modify a channel (text, voice, forum, overwrites). |
| `create_channel` | `guildId`, `name`, `type?`, plus the voice/forum/overwrite fields above | Create a channel. |
| `delete_channel` | `channelId`, `confirm` | Delete a channel (consent-gated). |
| `list_active_threads` | `channelId` | List a channel's active threads. |
| `create_thread` | `channelId`, `name`, `messageId?`, `type?`, `autoArchiveDuration?`, `rateLimitPerUser?` | Create a thread, or start one from a message. |
| `modify_thread` | `threadId`, `name?`, `archived?`, `locked?`, `autoArchiveDuration?`, `rateLimitPerUser?`, `appliedTags?` | Modify a thread. |
| `edit_channel_permissions` | `channelId`, `overwriteId`, `type`, `allow?`, `deny?` | Set a role/member permission overwrite (named permissions). |
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
| `embeds` | ✅ done | Create rich embeds. |
| `components` | ✅ send-only | Build messages with buttons and select menus (interaction runtime planned). |
| `webhooks` | ✅ done | Manage and execute webhooks. |
| `invites` | 🚧 planned | Generate invite links. |
| `emojis` | 🚧 planned | Manage server emojis. |
| `interactions` | 🚧 0.6.0 | Runtime for handling button/select interactions. |

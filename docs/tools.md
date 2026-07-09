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

## Selection pipeline

Most actions are per-guild, so a typical flow is:

1. `list_guilds` → pick a guild.
2. `get_guild` / `list_channels` → confirm guild and channel details.
3. `list_members` / `get_member` → pick a user.
4. Act (`read_messages`, `send_message`, `kick_member`, `modify_channel`, …).

## Consent model

Destructive tools require an explicit `"confirm": true` argument. Without it they return an error
and take no action. This applies to `kick_member`, `ban_member`, `delete_channel`, and
`delete_message`.

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
| `get_channel` | `channelId` | Get a single channel by ID. |

### Messaging
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `read_messages` | `channelId`, `limit?`, `before?`, `after?`, `around?` | Read recent channel messages. |
| `send_message` | `channelId`, `content`, `replyTo?` | Send a channel message. |
| `edit_message` | `channelId`, `messageId`, `content` | Edit a message's content. |
| `delete_message` | `channelId`, `messageId`, `confirm` | Delete a message (consent-gated). |

### Channels & guilds
| Tool | Inputs | Purpose |
| --- | --- | --- |
| `modify_channel` | `channelId`, `name?`, `topic?`, `nsfw?`, `rateLimitPerUser?`, `position?` | Modify channel name, description, NSFW, slowmode, position. |
| `create_channel` | `guildId`, `name`, `type?`, `topic?`, `nsfw?`, `parentId?`, `position?` | Create a channel. |
| `delete_channel` | `channelId`, `confirm` | Delete a channel (consent-gated). |
| `modify_guild` | `guildId`, `name?`, `description?`, `rulesChannelId?` | Modify guild name, description, rules channel. |

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
| `embeds` | 🚧 planned | Create rich embeds. |
| `invites` | 🚧 planned | Generate invite links. |
| `emojis` | 🚧 planned | Manage server emojis. |

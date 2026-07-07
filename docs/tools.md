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
token redaction on errors.

## Selection pipeline

Most actions are per-guild, so a typical flow is:

1. `list_guilds` → pick a guild.
2. `get_guild` → confirm guild details.
3. `list_members` / `get_member` → pick a user or channel.
4. Act (`read_messages`, `send_message`, `discord_request`, …).

## Available tools

| Tool | Inputs | Purpose |
| --- | --- | --- |
| `ping` | `message?` | Health check that responds with `pong`. |
| `list_guilds` | — | List the guilds the bot is a member of. |
| `get_guild` | `guildId` | Get details for a single guild. |
| `list_members` | `guildId`, `query?`, `limit?`, `after?` | List guild members (optionally by username search). |
| `get_member` | `guildId`, `userId` | Get a single guild member. |
| `read_messages` | `channelId`, `limit?`, `before?`, `after?`, `around?` | Read recent channel messages. |
| `send_message` | `channelId`, `content`, `replyTo?` | Send a channel message. |
| `discord_request` | `method`, `route`, `body?`, `query?`, `reason?` | Arbitrary Discord REST call. |

> `list_members` may require the `GUILD_MEMBERS` privileged intent to be enabled for the bot in the
> Discord Developer Portal.

## Roadmap

| Module | Status | Purpose |
| --- | --- | --- |
| `embeds` | 🚧 planned | Create rich embeds. |
| `channels` | 🚧 planned | Modify channel styles, descriptions, and rules; manage channels. |
| `moderation` | 🚧 planned | Kick/ban behind an explicit consent gate. |
| `invites` | 🚧 planned | Generate invite links. |
| `emojis` | 🚧 planned | Manage server emojis. |

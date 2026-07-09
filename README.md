# Crow

A Discord toolkit for AI agents.

Crow is an [MCP](https://modelcontextprotocol.io) (Model Context Protocol) server built on the
[`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk). It gives AI
agents first-class access to Discord — discovery, messaging, channels, moderation, and arbitrary
REST calls — through a small set of typed, consent-aware tools.

## Links

- [Getting Started](./docs/getting-started.md)
- [Tools](./docs/tools.md)
- [Build And Release](./docs/build-and-release.md)
- [GitHub Releases](https://github.com/Hydr46605/Crow/releases)

## What is Crow?

Crow is a single-purpose MCP server that bridges an AI agent and a Discord bot account. Configure it
once with a bot `userId` and `token`, connect it to any MCP client, and the agent can discover the
guilds, members, and channels it has access to, then read and send messages, manage channels, apply
consent-gated moderation, and fall back to raw Discord REST calls for edge cases.

Crow is deliberately small and convention-driven. Each capability is a self-contained tool module
registered through a single registry, so adding a Discord feature is a matter of writing one file
and registering it.

## Capabilities

- **Discovery** — list guilds, members, channels, and bans so the agent can select its target.
- **Messaging** — read, send, edit, and delete messages.
- **Channels** — inspect, configure (name, description, NSFW, slowmode), create, and delete channels.
- **Guild config** — set the guild name, description, and rules channel.
- **Moderation** — kick and ban behind an explicit consent gate; list and unban.
- **Raw REST** — a generic Discord REST escape hatch for any endpoint the typed tools do not cover.

Destructive actions (`kick_member`, `ban_member`, `delete_channel`, `delete_message`) require an
explicit `"confirm": true` consent flag.

## Tools

| Module | Tools |
| --- | --- |
| Health | `ping` |
| Discovery | `list_guilds`, `get_guild`, `list_members`, `get_member`, `list_channels`, `get_channel` |
| Messaging | `read_messages`, `send_message`, `edit_message`, `delete_message` |
| Channels | `modify_channel`, `create_channel`, `delete_channel` |
| Guild config | `modify_guild` |
| Moderation | `list_bans`, `get_ban`, `kick_member`, `ban_member`, `unban_member` |
| Raw | `discord_request` |

See [docs/tools.md](./docs/tools.md) for the full reference, the selection pipeline, and the
consent model.

## Quick Start

```bash
npm install
cp .env.example .env   # then fill in CROW_BOT_TOKEN and CROW_BOT_USER_ID
npm run build
npm start
```

Crow speaks MCP over stdio. Point your MCP client at it:

```json
{
  "mcpServers": {
    "crow": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "CROW_BOT_TOKEN": "<your-bot-token>",
        "CROW_BOT_USER_ID": "<your-bot-user-id>"
      }
    }
  }
}
```

## Compatibility

- Node.js `>= 22` (CI runs against 22 and 24).
- ESM-only.
- Discord API v10 via `discord.js`.
- Pre-1.0: the tool surface may still change during the `0.x` line.

## License

[MIT](./LICENSE)

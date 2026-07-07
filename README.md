# Crow

A Discord toolkit for AI agents.

Crow is an [MCP](https://modelcontextprotocol.io) (Model Context Protocol) server built on the
[`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk). It gives AI
agents first-class access to Discord — guild and member discovery, messaging, and arbitrary REST
calls — through a small set of typed, consent-aware tools.

## Links

- [Getting Started](./docs/getting-started.md)
- [Tools](./docs/tools.md)
- [Build And Release](./docs/build-and-release.md)
- [GitHub Releases](https://github.com/Hydr46605/Crow/releases)

## What is Crow?

Crow is a single-purpose MCP server that bridges an AI agent and a Discord bot account. Configure it
once with a bot `userId` and `token`, connect it to any MCP client, and the agent can discover the
guilds and members it has access to, then read and send messages or fall back to raw Discord REST
calls for edge cases.

Crow is deliberately small and convention-driven. Each capability is a self-contained tool module
registered through a single registry, so adding a Discord feature is a matter of writing one file
and registering it.

## Capabilities

- **Discovery** — list guilds and members so the agent can select its target.
- **Messaging** — read and send messages.
- **Raw REST** — a generic Discord REST escape hatch for any endpoint the typed tools do not cover.

Planned: embeds, channel configuration and management, consent-gated moderation, invites, and emoji
management.

## Tools

Available in `0.1.0`:

| Tool | Purpose |
| --- | --- |
| `ping` | Health check that responds with `pong`. |
| `list_guilds` / `get_guild` | Discover and inspect the guilds the bot belongs to. |
| `list_members` / `get_member` | Discover and inspect users within a guild. |
| `read_messages` / `send_message` | Read and send channel messages. |
| `discord_request` | Generic Discord REST API call for edge cases. |

> Actions are per-guild: discover a guild, list its members, then act. See
> [docs/tools.md](./docs/tools.md) for the selection pipeline and tool details.

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

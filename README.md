# Crow

A Discord toolkit for AI agents.

Crow is an [MCP](https://modelcontextprotocol.io) (Model Context Protocol) server built on the
[`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk). It gives AI
agents first-class access to Discord — messages, embeds, channels, moderation, invites, emojis, and
arbitrary REST calls — through a small set of typed, consent-aware tools.

## Links

- [Getting Started](./docs/getting-started.md)
- [Tools](./docs/tools.md)
- [Build And Release](./docs/build-and-release.md)
- [GitHub Releases](https://github.com/Hydr46605/Crow/releases)

## What is Crow?

Crow is a single-purpose MCP server that bridges an AI agent and a Discord bot account. Configure it
once with a bot `userId` and `token`, connect it to any MCP client, and the agent can read and send
messages, build embeds, tune channel styles, descriptions, and rules, create and manage channels,
apply moderation with an explicit consent gate, mint invites, manage emojis, and fall back to raw
Discord REST calls when a specific edge case is not covered.

Crow is deliberately small and convention-driven. Each capability is a self-contained tool module
registered through a single registry, so adding a Discord feature is a matter of writing one file
and registering it.

## Capabilities

- **Messaging** — read and send messages.
- **Embeds** — build rich embeds.
- **Channels** — modify channel styles, descriptions, and rules; create and manage channels.
- **Moderation** — kick and ban behind an explicit consent gate (destructive actions require confirmation).
- **Invites** — generate invite links.
- **Emojis** — manage server emojis.
- **Raw REST** — a generic Discord REST escape hatch for any endpoint the typed tools do not cover.

## Tools

| Module | Purpose |
| --- | --- |
| `ping` | Health check that responds with `pong`. |
| `messages` | Read and send channel messages. |
| `embeds` | Create rich embeds. |
| `channels` | Configure styles, descriptions, and rules; manage channels. |
| `moderation` | Kick/ban behind a consent gate. |
| `invites` | Generate invite links. |
| `emojis` | Manage server emojis. |
| `raw` | Generic Discord REST API call utility. |

> Tools ship incrementally. See [docs/tools.md](./docs/tools.md) for current status and the
> registration convention.

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

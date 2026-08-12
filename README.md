<p align="center">
  <img src="assets/crow-logo.png" alt="Crow logo" width="180" />
</p>

# Crow

A Discord toolkit for AI agents.

Crow is an [MCP](https://modelcontextprotocol.io) (Model Context Protocol) server built on the
[`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk). It gives AI
agents first-class access to Discord: discovery, messaging, channels, moderation, and arbitrary
REST calls, through a small set of typed, consent-aware tools.

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

- **Discovery**: list guilds, members, channels, and bans so the agent can select its target.
- **Messaging**: read, send, edit, and delete messages.
- **Embeds**: build rich embeds with Discord's limits enforced.
- **Components**: send messages with buttons and select menus (send-only for now).
- **Channels**: full control: text/voice/forum settings, threads, and permission overwrites.
- **Guild config**: set the guild name, description, and rules channel.
- **Webhooks**: create, manage, and execute webhooks.
- **Moderation**: kick and ban behind an explicit consent gate; list and unban.
- **Raw REST**: a generic Discord REST escape hatch for any endpoint the typed tools do not cover.

Destructive actions (`kick_member`, `ban_member`, `delete_channel`, `delete_message`,
`delete_webhook`) require an explicit `"confirm": true` consent flag.

Every tool also declares MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`,
`openWorldHint`) plus human-readable titles and per-field descriptions, so clients can present and
permission the tools safely.

## Tools

| Module | Tools |
| --- | --- |
| Health | `ping` |
| Discovery | `list_guilds`, `get_guild`, `list_members`, `get_member`, `list_channels`, `get_channel` |
| Messaging | `read_messages`, `send_message`, `edit_message`, `delete_message` |
| Embeds | `create_embed` |
| Channels & threads | `modify_channel`, `create_channel`, `delete_channel`, `list_active_threads`, `create_thread`, `modify_thread`, `edit_channel_permissions`, `delete_channel_permissions` |
| Guild config | `modify_guild` |
| Webhooks | `list_webhooks`, `get_webhook`, `create_webhook`, `modify_webhook`, `delete_webhook`, `execute_webhook` |
| Moderation | `list_bans`, `get_ban`, `kick_member`, `ban_member`, `unban_member` |
| Raw | `discord_request` |

See [docs/tools.md](./docs/tools.md) for the full reference, the selection pipeline, and the
consent model.

## Quick Start

Install with one command, which clones the repo, builds it, links the `crow` command onto your PATH,
and drops you into the setup wizard:

```bash
curl -fsSL https://raw.githubusercontent.com/Hydr46605/Crow/main/install.sh | sh
```

Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/Hydr46605/Crow/main/install.ps1 | iex
```

Windows (cmd.exe):

```bat
curl -o install.bat https://raw.githubusercontent.com/Hydr46605/Crow/main/install.bat && install.bat
```

The wizard asks for your bot token, detects the bot user ID, verifies the token against Discord,
and checks that the privileged intents Crow needs (`GUILD_MEMBERS`, `MESSAGE_CONTENT`) are enabled,
prompting you to fix and re-check them if they are not.

## Command line

Crow ships a single `crow` command:

| Command | What it does |
| --- | --- |
| `crow` / `crow serve` | Run the MCP server over stdio. |
| `crow setup` | Interactive setup wizard (token → user ID → intent check → save). |
| `crow doctor` | Check the bot token and privileged intents. |
| `crow --version` | Print the version. |
| `crow --help` | Show help. |

Credentials live in `~/.crow/.env` (owner-readable) and are loaded automatically, so an MCP client
config is just:

```json
{
  "mcpServers": {
    "crow": {
      "command": "crow"
    }
  }
}
```

Prefer inline credentials? You can still set `CROW_BOT_TOKEN` and `CROW_BOT_USER_ID` in the
client's `env` block instead.

### Build from source

```bash
git clone https://github.com/Hydr46605/Crow.git
cd Crow
npm install
npm run build
npm start
```

## Compatibility

- Node.js `>= 22` (CI runs against 22 and 24).
- ESM-only.
- Discord API v10 via `discord.js`.
- Distributed via GitHub (not npm); install with the scripts above.
- Pre-1.0: the tool surface may still change during the `0.x` line.

## License

[MIT](./LICENSE)

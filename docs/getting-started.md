# Getting Started

Crow is an [MCP](https://modelcontextprotocol.io) server. It runs as a child process and talks to
an MCP client over standard input/output, so it has no UI of its own — you connect it to a client
such as Claude, Cursor, or another MCP-aware host.

## Prerequisites

- Node.js `>= 22`
- A Discord application with a bot user
  ([Discord Developer Portal](https://discord.com/developers/applications))

## Install

Crow is distributed through GitHub, not npm. The installer clones the repo, builds it, and links a
single `crow` command onto your PATH:

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

All three installers accept a `--no-setup` (or `-NoSetup`) flag to skip the wizard. Set
`CROW_INSTALL_DIR` to change where the code is cloned (default `~/.crow/app`) and `CROW_BIN_DIR` to
change where the `crow` launcher is written (default `~/.local/bin`).

## Setup wizard

Running `crow setup` walks through configuration step by step:

1. **Bot token** — entered invisibly and verified against Discord immediately; a rejected token is
   re-prompted.
2. **Bot user ID** — auto-detected from the token, with a chance to confirm or override it.
3. **Privileged intents** — Crow checks that `GUILD_MEMBERS` (member listing) and `MESSAGE_CONTENT`
   (reading message text) are enabled. If one is missing, the wizard tells you exactly which one,
   waits for you to enable it in the Developer Portal, and re-checks when you confirm.

Credentials are written to `~/.crow/.env` with owner-only (`0600`) permissions. To relocate them,
set the `CROW_HOME` environment variable.

## The `crow` command

| Command | What it does |
| --- | --- |
| `crow` / `crow serve` | Run the MCP server over stdio. |
| `crow setup` | Interactive setup wizard. |
| `crow doctor` | Check the bot token and privileged intents (exits non-zero if unhealthy). |
| `crow --version` | Print the version. |
| `crow --help` | Show help. |

## Connect an MCP client

Because the wizard stores credentials in `~/.crow/.env`, a client config needs no environment:

```json
{
  "mcpServers": {
    "crow": {
      "command": "crow"
    }
  }
}
```

If you prefer inline credentials, point the client at the built entrypoint and pass them explicitly:

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

## Build from source

```bash
git clone https://github.com/Hydr46605/Crow.git
cd Crow
npm install
npm run build
npm start
```

For development with hot reload:

```bash
npm run dev
```

See [Tools](./tools.md) for the available capabilities and
[Build And Release](./build-and-release.md) for the development workflow.

# Getting Started

Crow is an [MCP](https://modelcontextprotocol.io) server. It runs as a child process and talks to
an MCP client over standard input/output, so it has no UI of its own — you connect it to a client
such as Claude, Cursor, or another MCP-aware host.

## Prerequisites

- Node.js `>= 22`
- A Discord application with a bot user
  ([Discord Developer Portal](https://discord.com/developers/applications))

## Setup

```bash
git clone https://github.com/Hydr46605/Crow.git
cd Crow
npm install
cp .env.example .env
```

Edit `.env` and set your credentials:

| Variable | Description |
| --- | --- |
| `CROW_BOT_TOKEN` | The bot token from the Discord Developer Portal. |
| `CROW_BOT_USER_ID` | The snowflake user ID of the bot account. |

## Run

```bash
npm run build
npm start
```

For development with hot reload:

```bash
npm run dev
```

## Connect an MCP client

Crow speaks MCP over stdio. Configure your client with:

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

See [Tools](./tools.md) for the available capabilities and
[Build And Release](./build-and-release.md) for the development workflow.

# Tools

Crow exposes Discord capabilities as MCP tools. Every tool is a self-contained module under
`src/tools/` and registers itself through the shared registry in `src/tools/index.ts`.

## Convention

A tool module exports:

1. A pure `handler` — the business logic, unit-testable without the MCP layer.
2. A `register<Name>Tool(server, ctx)` function that binds the handler to the MCP server with a
   Zod input schema.

`ctx` is the shared `CrowContext` (`config` + `discord` REST client) handed to every handler.

## Roadmap

| Tool | Status | Purpose |
| --- | --- | --- |
| `ping` | ✅ available | Health check that responds with `pong`. |
| `messages` | 🚧 planned | Read and send channel messages. |
| `embeds` | 🚧 planned | Create rich embeds. |
| `channels` | 🚧 planned | Modify channel styles, descriptions, and rules; manage channels. |
| `moderation` | 🚧 planned | Kick/ban behind an explicit consent gate. |
| `invites` | 🚧 planned | Generate invite links. |
| `emojis` | 🚧 planned | Manage server emojis. |
| `raw` | 🚧 planned | Generic Discord REST API call utility for edge cases. |

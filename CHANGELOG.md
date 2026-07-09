# Changelog

## [0.2.0] - 2026-08-16
### Added
- Moderation tools: `list_bans`, `get_ban`, `kick_member`, `ban_member`, and `unban_member`.
- Channel tools: `list_channels`, `get_channel`, `modify_channel`, `create_channel`, and `delete_channel`.
- Guild configuration: `modify_guild` (name, description, and rules channel).
- Messaging expansion: `edit_message` and `delete_message`.
- Explicit consent gate for destructive actions (kick, ban, delete channel, delete message).
- Centralized error handling via an `attempt` helper across all tools.

## [0.1.0] - 2026-08-16
### Added
- Initial MCP server foundation: environment-based configuration, CI/CD workflows, and documentation.
- `ping` tool as the reference implementation of the tool-module convention.
- Generic Discord REST client with request options and token redaction on errors.
- Messaging tools: `read_messages` and `send_message`.
- Raw REST tool: `discord_request` for arbitrary Discord API calls.
- Guild discovery tools: `list_guilds` and `get_guild`.
- Member discovery tools: `list_members` and `get_member`.
- Security hardening: token masking/redaction and credential validation.
- Full test suite covering config, security, the Discord client, and every tool.

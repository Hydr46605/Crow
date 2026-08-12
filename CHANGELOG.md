# Changelog

## [0.5.0] - 2026-08-16
### Added
- Embeds: `create_embed` plus `embeds` support on `send_message`, `edit_message`, and `execute_webhook`, with Discord's limits enforced.
- Components (send-only): buttons (all 5 styles), string/user/role/mentionable/channel select menus, and action rows, attachable to messages and webhooks.
- Webhooks: `list_webhooks`, `get_webhook`, `create_webhook`, `modify_webhook`, `delete_webhook`, and `execute_webhook` (via the webhook token).
- Channels: `list_active_threads`, `create_thread`, `modify_thread`, `edit_channel_permissions` (named permissions), plus voice/forum settings and richer summaries.
### Changed
- `send_message` now supports embeds, components, allowed mentions, and TTS; `edit_message` supports embeds and components.
- `modify_channel`/`create_channel` now support voice settings, forum settings, and permission overwrites.
- `get_channel`/`list_channels` return type names, categories, and parsed permission overwrites.

## [0.4.0] - 2026-08-16
### Added
- `crow` CLI command (`serve`, `setup`, `doctor`, `--version`, `--help`).
- Interactive setup wizard with live token verification, bot user ID auto-detection, and a privileged-intent check with a fix-and-recheck flow.
- `crow doctor` to validate the bot token and report `GUILD_MEMBERS` / `MESSAGE_CONTENT` intent status.
- One-command installers: `install.sh`, `install.ps1`, and `install.bat` for GitHub distribution.
- `CROW_HOME` configuration directory and `saveConfig` for owner-readable credential storage.
### Changed
- Distribution is now GitHub-only: the package is marked `private` and the release workflow no longer publishes to npm.
- The entrypoint now dispatches CLI commands in addition to serving MCP over stdio.
### Security
- Discord request errors now carry their HTTP status code, enabling accurate 401 detection without exposing the token.
- The bot token is captured with hidden input and stored in `~/.crow/.env` with `0600` permissions.

## [0.3.0] - 2026-08-16
### Added
- MCP tool annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) on every tool so agents can reason about safety.
- Human-readable tool titles and per-field input descriptions surfaced through each tool's schema.
### Changed
- Renamed `rateLimitPerUser` to `slowmodeSeconds` in `modify_channel` for clarity.
- Error results now include the failing action (e.g. `read_messages failed: ...`).
### Security
- Read-only and destructive behavior is now machine-readable via annotations.

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

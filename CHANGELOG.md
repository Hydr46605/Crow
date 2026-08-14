# Changelog

## [0.9.0] - 2026-09-08
### Security
- File downloads now accept `http(s)` URLs only and are capped to their size limit while streaming (no unbounded or non-HTTP fetches).
- `SECURITY.md` now lists every consent-gated destructive tool and the secret-redaction guarantees.
### Changed
- Webhook execution and interaction callbacks retry transient failures (408, 429, 5xx) with exponential backoff.
- The gateway daemon logs state transitions, handles unhandled rejections, and exits cleanly on a fatal exception so a supervisor can restart it.
- `modify_member` and `modify_role` reject empty updates instead of sending a no-op request to Discord.
- The MCP server now advertises `instructions` describing the per-guild flow and consent model.
- Added `docs/gateway.md` with a systemd example for running `crow gateway` persistently.

## [0.8.0] - 2026-09-01
### Added
- Roles: `list_roles`, `create_role`, `modify_role`, and `delete_role` (consent-gated), with named permissions and hex/int color support.
- Member management: `modify_member` (nickname, voice mute/deafen/move, timeout), `add_role_to_member`, and `remove_role_from_member`.
- Reactions: `add_reaction`, `remove_own_reaction`, `remove_user_reaction`, and `list_reactions` for unicode and custom `name:id` emojis.
- Messages: `pin_message`, `unpin_message`, and `bulk_delete_messages` (consent-gated, 2-100 messages).
- Audit: `list_audit_log_entries` for reading who changed what, filterable by user and action type.
### Changed
- `members.ts` and `messages.ts` now register the new member and message tools.
- The consent and idempotent annotation lists now cover the new destructive and reversible writes.

## [0.7.0] - 2026-08-24
### Added
- `crow gateway` daemon that connects to the Discord Gateway (native WebSocket), identifies with the `GUILDS` intent, and dispatches live interactions with heartbeat ack-tracking, resume, and exponential-backoff reconnect.
- Modal actions: `register_action` now accepts `kind: "modal"` to open a form (up to 5 text inputs) and reply on submit; `kind: "reply"` (the default) keeps the existing click-to-reply behavior.
- `DiscordClient.interactionCallback` for type-4 and type-9 interaction callbacks, with interaction-token redaction on errors.
### Changed
- `resolveInteraction` now reads the interaction type and returns either a channel-message or modal callback.
- `Action` is a discriminated union; legacy registry entries without a `kind` load as replies.

## [0.6.0] - 2026-08-16
### Added
- Invites: `list_guild_invites`, `list_channel_invites`, `get_invite`, `get_vanity_url`, `create_invite`, and `delete_invite` (consent-gated), with invite code and URL normalization.
- Emojis: `list_emojis`, `get_emoji`, `create_emoji` (data URI or file source), `modify_emoji`, and `delete_emoji` (consent-gated).
- Stickers: `list_stickers`, `get_sticker`, `list_sticker_packs`, `get_sticker_pack`, `create_sticker` (multipart upload), `modify_sticker`, and `delete_sticker` (consent-gated).
- Actions runtime foundation: `register_action`, `list_actions`, and `remove_action` backed by a persistent registry (`~/.crow/actions.json`) plus a pure `resolveInteraction` hook for the future Gateway transport.
- Message attachments: `send_message` and `edit_message` now accept files (local path, URL, or base64/data URI) via multipart upload.
- Shared file-source resolver with size limits and content-type inference.
### Changed
- `DiscordClient` now supports multipart requests (`files` and `appendToFormData`).
- `CrowContext` now carries the action runtime alongside config and the Discord client.

## [0.5.0] - 2026-08-05
### Added
- Embeds: `create_embed` plus `embeds` support on `send_message`, `edit_message`, and `execute_webhook`, with Discord's limits enforced.
- Components (send-only): buttons (all 5 styles), string/user/role/mentionable/channel select menus, and action rows, attachable to messages and webhooks.
- Webhooks: `list_webhooks`, `get_webhook`, `create_webhook`, `modify_webhook`, `delete_webhook`, and `execute_webhook` (via the webhook token).
- Channels: `list_active_threads`, `create_thread`, `modify_thread`, `edit_channel_permissions` and `delete_channel_permissions` (named permissions), plus voice/forum settings and richer summaries.
- Added a project logo (`assets/crow-logo.png`) and integrated it into the README.
### Changed
- `send_message` now supports embeds, components, allowed mentions, and TTS; `edit_message` supports embeds and components.
- `modify_channel`/`create_channel` now support voice settings, forum settings, and permission overwrites.
- `get_channel`/`list_channels` return type names, categories, and parsed permission overwrites.

## [0.4.0] - 2026-07-22
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

## [0.3.0] - 2026-07-15
### Added
- MCP tool annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) on every tool so agents can reason about safety.
- Human-readable tool titles and per-field input descriptions surfaced through each tool's schema.
### Changed
- Renamed `rateLimitPerUser` to `slowmodeSeconds` in `modify_channel` for clarity.
- Error results now include the failing action (e.g. `read_messages failed: ...`).
### Security
- Read-only and destructive behavior is now machine-readable via annotations.

## [0.2.0] - 2026-07-10
### Added
- Moderation tools: `list_bans`, `get_ban`, `kick_member`, `ban_member`, and `unban_member`.
- Channel tools: `list_channels`, `get_channel`, `modify_channel`, `create_channel`, and `delete_channel`.
- Guild configuration: `modify_guild` (name, description, and rules channel).
- Messaging expansion: `edit_message` and `delete_message`.
- Explicit consent gate for destructive actions (kick, ban, delete channel, delete message).
- Centralized error handling via an `attempt` helper across all tools.

## [0.1.0] - 2026-07-07
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

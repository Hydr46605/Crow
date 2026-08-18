<p align="center">
  <img src="assets/crow-logo.png" alt="Crow logo" width="180" />
</p>

<h1 align="center">Crow</h1>

<p align="center"><em>A Discord toolkit for AI agents.</em></p>

Crow is an [MCP](https://modelcontextprotocol.io) (Model Context Protocol) server built on the
[`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk). It gives AI
agents first-class access to Discord: discovery, messaging, channels, invites, emojis, stickers,
moderation, and arbitrary REST calls, through a small set of typed, consent-aware tools.

## Links

- [Getting Started](./docs/getting-started.md)
- [Tools](./docs/tools.md)
- [Gateway](./docs/gateway.md)
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
- **Overview**: `get_guild_overview` gives a one-call orientation of a guild (basics + boost info, channels grouped by category, and roles).
- **Notes**: attach local, informational notes to users, roles, channels, messages, guilds, webhooks, and more, so context survives across agent sessions.
- **Messaging**: read (with embeds, components, and attachments), send, edit, delete, pin, and bulk-delete messages.
- **Direct messages**: list DM channels, send DMs, and read DM history with content, embeds, components, and attachments.
- **Embeds**: build rich embeds with Discord's limits enforced.
- **Components**: send messages with buttons, select menus, and Components V2 layout (containers, sections, text, media galleries, thumbnails, separators, files).
- **Channels**: full control: text/voice/forum settings, threads, forum posts, and permission overwrites.
- **Guild config**: set the guild name, description, and rules channel.
- **Roles**: create, modify, and delete roles; assign and remove them from members.
- **Members**: dedicated tools for timeouts, nicknames, and voice movement, plus role assignment.
- **Self**: read and modify the bot's own profile (username, avatar, banner, bio) and its per-guild member profile (nickname, guild avatar/banner/bio).
- **Voice**: read and modify stage-channel voice states (suppress, request-to-speak, and move between stage channels).
- **Reactions**: add, remove, and list message reactions.
- **Audit**: read the guild audit log.
- **Community**: manage the welcome screen, onboarding, and membership screening.
- **Boost**: read a guild's Server Boost level, boost count, and progress bar state.
- **Webhooks**: create, manage, and execute webhooks.
- **Attachments**: send files, images, and GIFs alongside messages.
- **Invites**: list, create, inspect, and delete guild and channel invites.
- **Emojis**: create, list, modify, and delete custom emojis.
- **Stickers**: create, list, modify, and delete guild stickers, plus sticker packs.
- **Actions**: register replies and modals for component interactions, and inspect the values users submit.
- **Gateway**: `crow gateway` daemon receives interactions live and dispatches registered actions.
- **Moderation**: kick and ban behind an explicit consent gate; list, unban, and count prunable members.
- **Automod**: create, list, modify, and delete auto-moderation rules.
- **Scheduled events**: create, list, modify, and delete guild scheduled events and list interested users.
- **Polls**: attach polls to messages, list voters, and end polls.
- **Listening**: `wait_for_message` blocks until a new message arrives in a channel.
- **Guardrails**: block tools by name, category, raw REST route, or whole guild.
- **Raw REST**: a generic Discord REST escape hatch for any endpoint the typed tools do not cover.

Destructive actions (`kick_member`, `ban_member`, `delete_channel`, `delete_message`,
`delete_webhook`, `delete_invite`, `delete_emoji`, `delete_sticker`, `delete_role`,
`delete_automod_rule`, `delete_scheduled_event`, `bulk_delete_messages`) require an explicit
`"confirm": true` consent flag.

Every tool also declares MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`,
`openWorldHint`) plus human-readable titles and per-field descriptions, so clients can present and
permission the tools safely.

## Tools

| Module | Tools |
| --- | --- |
| Health | `ping` |
| Discovery | `list_guilds`, `get_guild`, `list_members`, `get_member`, `list_channels`, `get_channel` |
| Overview | `get_guild_overview` |
| Messaging | `read_messages`, `send_message`, `wait_for_message`, `edit_message`, `delete_message`, `pin_message`, `unpin_message`, `bulk_delete_messages` |
| Direct messages | `list_dm_channels`, `get_dm_channel`, `send_dm`, `read_dm_messages` |
| Embeds | `create_embed` |
| Channels & threads | `modify_channel`, `create_channel`, `delete_channel`, `list_active_threads`, `list_archived_threads`, `create_thread`, `modify_thread`, `edit_channel_permissions`, `delete_channel_permissions` |
| Guild config | `modify_guild` |
| Roles | `list_roles`, `create_role`, `modify_role`, `delete_role` |
| Members | `modify_member`, `timeout_member`, `remove_timeout_member`, `set_member_nickname`, `reset_member_nickname`, `disconnect_member_from_voice`, `move_member_to_voice`, `add_role_to_member`, `remove_role_from_member` |
| Self | `get_current_user`, `modify_current_user`, `modify_current_member` |
| Voice | `get_voice_state`, `modify_voice_state` |
| Reactions | `add_reaction`, `remove_own_reaction`, `remove_user_reaction`, `list_reactions` |
| Audit | `list_audit_log_entries` |
| Community | `get_welcome_screen`, `modify_welcome_screen`, `get_onboarding`, `modify_onboarding`, `get_member_verification`, `modify_member_verification` |
| Boost | `get_boost_info` |
| Webhooks | `list_webhooks`, `get_webhook`, `create_webhook`, `modify_webhook`, `delete_webhook`, `execute_webhook` |
| Invites | `list_guild_invites`, `list_channel_invites`, `get_invite`, `get_vanity_url`, `create_invite`, `delete_invite` |
| Emojis | `list_emojis`, `get_emoji`, `create_emoji`, `modify_emoji`, `delete_emoji` |
| Stickers | `list_stickers`, `get_sticker`, `list_sticker_packs`, `get_sticker_pack`, `create_sticker`, `modify_sticker`, `delete_sticker` |
| Actions | `register_action`, `list_actions`, `remove_action`, `list_recent_interactions` |
| Notes | `add_note`, `list_notes`, `remove_note`, `clear_notes` |
| Moderation | `list_bans`, `get_ban`, `kick_member`, `ban_member`, `unban_member`, `get_prune_count` |
| Polls | `get_poll_answer_voters`, `end_poll` |
| Automod | `list_automod_rules`, `get_automod_rule`, `create_automod_rule`, `modify_automod_rule`, `delete_automod_rule` |
| Scheduled events | `list_scheduled_events`, `get_scheduled_event`, `create_scheduled_event`, `modify_scheduled_event`, `delete_scheduled_event`, `get_scheduled_event_users` |
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
| `crow gateway` | Run the always-on interaction gateway daemon. |
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

## License

[MIT](./LICENSE)

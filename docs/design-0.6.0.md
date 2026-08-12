# Crow 0.6.0 Design

## Overview

0.6.0 adds three complete tool suites (invites, emojis, stickers), a foundational
actions runtime for component interactions, and file attachment support in
messaging. The release grows Crow from 33 to 54 tools.

## File infrastructure

A shared `src/files.ts` module resolves a file source into bytes plus a content
type. Each source accepts exactly one of:

- `path`: a local file path, read from disk.
- `url`: an `http(s)` URL, fetched with a download cap.
- `data`: base64 text or a full data URI.

Resolution returns `{ name, data, contentType }` with extension-based content-type
inference and size limits (25 MB for message attachments, 512 KB for stickers).
A `toDataUri` helper converts a resolved file for endpoints that need a data URI.

`DiscordClient` gains `files` and `appendToFormData` on request options, passed
through to the discord.js `REST` multipart builder. Emoji creation stays plain
JSON (image as a data URI); sticker creation and message attachments use multipart.

## Invites

| Tool | Endpoint | Annotation |
| --- | --- | --- |
| `list_guild_invites` | `GET /guilds/{id}/invites` | read-only |
| `list_channel_invites` | `GET /channels/{id}/invites` | read-only |
| `get_invite` | `GET /invites/{code}` (`withCounts?`, `withExpiration?`) | read-only |
| `get_vanity_url` | `GET /guilds/{id}/vanity-url` | read-only |
| `create_invite` | `POST /channels/{id}/invites` | write |
| `delete_invite` | `DELETE /invites/{code}` | destructive + consent |

`create_invite` accepts `maxAge?`, `maxUses?`, `temporary?`, `unique?`,
`targetType?`, `targetUserId?`, `targetApplicationId?`, and `reason?`. Invite
codes accept either a bare code or a `discord.gg` / `discord.com/invite` URL.
`targetType` is cross-validated against its required target field.

## Emojis

| Tool | Endpoint | Annotation |
| --- | --- | --- |
| `list_emojis` | `GET /guilds/{id}/emojis` | read-only |
| `get_emoji` | `GET /guilds/{id}/emojis/{emojiId}` | read-only |
| `create_emoji` | `POST /guilds/{id}/emojis` | write |
| `modify_emoji` | `PATCH /guilds/{id}/emojis/{emojiId}` | idempotent |
| `delete_emoji` | `DELETE /guilds/{id}/emojis/{emojiId}` | destructive + consent |

`create_emoji` takes `name`, `image`, `roles?`, and `reason?`. `image` accepts a
data URI or a file source, converted to a data URI. `name` is `2-32` characters of
`[a-zA-Z0-9_]`.

## Stickers

| Tool | Endpoint | Annotation |
| --- | --- | --- |
| `list_stickers` | `GET /guilds/{id}/stickers` | read-only |
| `get_sticker` | `GET /guilds/{id}/stickers/{stickerId}` | read-only |
| `list_sticker_packs` | `GET /sticker-packs` | read-only |
| `get_sticker_pack` | `GET /sticker-packs/{packId}` | read-only |
| `create_sticker` | `POST /guilds/{id}/stickers` | write (multipart) |
| `modify_sticker` | `PATCH /guilds/{id}/stickers/{stickerId}` | idempotent |
| `delete_sticker` | `DELETE /guilds/{id}/stickers/{stickerId}` | destructive + consent |

`create_sticker` takes `name`, `description?`, `tags`, and `file`. The file is a
file source uploaded as the multipart `file` field. `name` is `2-30` characters,
`description` at most 100, `tags` at most 200.

## Actions runtime

The foundation for receiving component interactions. No live transport yet; the
Gateway connection lands in a later release.

- `Action = { customId, content?, embeds?, ephemeral? }`. Embeds reuse the shared
  embed schema.
- `ActionRuntime` holds a `Map<customId, Action>`, persists to
  `~/.crow/actions.json` (mode `0600`), and validates on load with zod.
- `register` (upsert), `list`, and `remove` mutate and persist.
- `resolveInteraction(actions, interaction)` is the pure hook: given a Discord
  interaction payload it returns `{ matched, reply }` where `reply` is the type-4
  callback (`content`, `embeds`, `flags: 64` when ephemeral).

Tools: `register_action` (idempotent), `list_actions` (read-only), `remove_action`
(idempotent). No consent gate: actions mutate only Crow's own registry.

The runtime is wired into `CrowContext` as `actions` and constructed in `serve`.

## Messaging attachments

`send_message` and `edit_message` gain an `attachments` array (up to 10 entries),
each accepting `{ name?, path?|url?|data?, description? }`. Files are resolved via
`src/files.ts` and sent as multipart with `body.attachments` referencing file
indices.

## Security and robustness

- `delete_invite`, `delete_emoji`, and `delete_sticker` are consent-gated.
- Audit-log `reason` is forwarded wherever Discord supports it.
- All inputs are zod-validated (snowflakes, code format, data URI, name charset).
- File sources enforce size limits and reject malformed input before any request.
- Errors flow through the existing `attempt` helper with token redaction.

## Testing and release

- Unit tests for the files resolver, multipart option plumbing, every new tool,
  and the actions runtime (register, list, remove, persistence, hook resolution).
- Update `docs/tools.md`, `README.md`, and `CHANGELOG.md`; bump to 0.6.0.
- Typecheck, build, and the full test suite must pass before release.

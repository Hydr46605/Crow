# Security

Crow holds a Discord bot token and can perform destructive actions on a server. Treat it with the
same care you would give the token itself.

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue. Open a draft security
advisory on the [Security](https://github.com/Hydr46605/Crow/security) tab, or contact the
maintainer directly.

## Keeping secrets safe

- Never commit `.env` or a real token. `.env` is git-ignored; only `.env.example` is tracked.
- The bot token is loaded into memory only, validated to reject whitespace, and never logged;
  error messages are scrubbed with `[REDACTED]` before being returned or printed.
- Webhook tokens and interaction tokens are also redacted from any error Crow surfaces.
- Credentials, the action registry, and local notes are stored owner-readable (`0600`) under `~/.crow`. Notes never leave the machine and are never sent to Discord.
- File downloads for attachments, stickers, and emoji accept `http(s)` URLs only and are capped to
  their size limit while streaming, so a malicious URL cannot exhaust memory.

## Destructive actions

The following tools are destructive and require an explicit `"confirm": true` consent flag.
Without consent they return an error and perform no action:

`kick_member`, `ban_member`, `delete_channel`, `delete_message`, `delete_webhook`,
`delete_invite`, `delete_emoji`, `delete_sticker`, `delete_role`, and `bulk_delete_messages`.

## Least privilege

Grant the bot only the permissions its tasks actually require. Prefer read-only tools, and check
each tool's annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`) before acting.

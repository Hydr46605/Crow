# Security

Crow holds a Discord bot token and can perform destructive actions on a server. Treat it with the
same care you would give the token itself.

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue. Open a draft security
advisory on the [Security](https://github.com/Hydr46605/Crow/security) tab, or contact the
maintainer directly.

## Keeping your token safe

- Never commit `.env` or a real token. `.env` is git-ignored; only `.env.example` is tracked.
- `CROW_BOT_TOKEN` is loaded into memory only, validated to reject whitespace, and never logged;
  error messages are scrubbed with `[REDACTED]` before being returned or printed.
- The `discord_request` tool can reach any endpoint the bot can; the token stays server-side and is
  never exposed to the caller.

## Destructive actions

`kick_member`, `ban_member`, `delete_channel`, and `delete_message` are destructive and require an
explicit `"confirm": true` consent flag. Without consent they return an error and perform no action.

## Least privilege

Grant the bot only the permissions its tasks actually require.

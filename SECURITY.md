# Security

Crow holds a Discord bot token and can perform destructive actions on a server. Treat it with the
same care you would give the token itself.

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue. Open a draft security
advisory on the [Security](https://github.com/Hydr46605/Crow/security) tab, or contact the
maintainer directly.

## Keeping your token safe

- Never commit `.env` or a real token. `.env` is git-ignored; only `.env.example` is tracked.
- `CROW_BOT_TOKEN` is loaded into memory only and is never logged.
- Moderation tools gate destructive actions (kick/ban) behind an explicit consent flag.
- Grant the bot only the permissions its tasks actually require.

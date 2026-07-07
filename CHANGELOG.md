# Changelog

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

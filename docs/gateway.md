# Gateway

The `crow gateway` daemon keeps a persistent connection to Discord's Gateway so Crow can receive
button, select-menu, and modal interactions at any time, even when no MCP client is running.

## How it works

- Connects over a native WebSocket with the `GUILDS` intent.
- Identifies with the bot token, then heartbeats with ack-tracking and zombie detection.
- Resumes with `session_id`/`seq` after a disconnect, and reconnects with exponential backoff.
- On `INTERACTION_CREATE`, resolves the component's `custom_id` against the actions registered via
  `register_action` and replies with the matching message or modal callback.

Register actions from any MCP session (`register_action`, `list_actions`, `remove_action`); the
daemon reads the same `~/.crow/actions.json`, so actions take effect as soon as they are saved.

## Run it

```bash
crow gateway
```

The daemon logs state changes (`connecting`, `ready`, `resuming`, `closed`) and dispatched
interactions to stdout, with the bot token redacted.

## Run it persistently (systemd)

Create `/etc/systemd/system/crow-gateway.service`:

```ini
[Unit]
Description=Crow Discord interaction gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/env crow gateway
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now crow-gateway
```

Make sure `crow` is on the PATH (the installer links it to `~/.local/bin`) and that
`CROW_BOT_TOKEN` / `CROW_BOT_USER_ID` are readable by the service user (they live in `~/.crow/.env`
by default).

## Notes

- The daemon needs the same credentials as `crow serve`; run `crow setup` or `crow doctor` first.
- It only listens for interactions. Reading messages and member listings still go through the MCP
  tools and their privileged intents.

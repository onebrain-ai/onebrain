# Web UI

`onebrain serve` runs an embedded web UI and JSON API over your vault — no separate install.

> Part of [OneBrain docs](../README.md)

## Quick start

```bash
cd my-vault
onebrain serve --open      # binds 127.0.0.1:6789, opens the URL with a token in your default browser
```

```bash
onebrain serve --port 8080           # bind a different port
onebrain serve --host 0.0.0.0        # remote self-host — MUST sit behind TLS (see below)
```

Ctrl-C stops the server; it runs in the foreground.

## What's in it

| Feature | Notes |
|---|---|
| File explorer | Browse the vault tree |
| Reading view | Markdown, code, PDF, Office docs, images, audio/video, Jupyter notebooks |
| Search panel | Built-in vault search |
| Agent chat | Chat against the vault from the browser |
| Vault JSON API | Token-gated, loopback-only by default |

## Configuration

No `onebrain.yml` keys — all serve behavior is CLI-flag driven:

| Flag | Purpose |
|---|---|
| `--port <PORT>` | Bind port (default 6789) |
| `--host <ADDR>` | Bind host (default 127.0.0.1); use `0.0.0.0` for remote self-host |
| `--open` | Open the served URL in the default browser after binding |
| `--dir <PATH>` | Serve a static web dist instead of the embedded UI (web-UI development only) |

## Notes

- Default bind is loopback-only (`127.0.0.1`) — the API is not reachable from other machines unless you set `--host 0.0.0.0`.
- The served URL includes a token query parameter (`?token=<TOKEN>`) that gates the JSON API.
- Binding `0.0.0.0` for single-tenant remote self-host **must** sit behind TLS — see the [onebrain-cli README](https://github.com/onebrain-ai/onebrain-cli#local-web-ui) for the self-host + TLS walkthrough and full flag reference.

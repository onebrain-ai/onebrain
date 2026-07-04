# CLI Command Map

One-line orientation to every top-level `onebrain` command, grouped as the CLI's own `--help` groups them.

> Part of [OneBrain docs](README.md)

## Quick start

```bash
onebrain --help          # full command list
onebrain <command> --help  # per-command flags
```

## System Management

| Command | Purpose |
|---|---|
| `init` | Initialize a new vault (interactive setup) |
| `update` | Self-update the CLI binary (auto-detects install channel) |
| `doctor` | Diagnose system (vault + plugin + CLI, includes harness) |
| `plugin` | Plugin lifecycle + hook rewriter |
| `qmd` | Vault search index (legacy — see [search.md](search.md) for the current native search surface) |
| `schedule` | launchd schedule management — see [scheduling.md](scheduling.md) |

## Vault Management

| Command | Purpose |
|---|---|
| `vault` | Vault operations (sync · current) |
| `note` | Vault note operations (search · read · edit · move · archive · …) |
| `task` | List dated vault tasks (fence-aware) |
| `search` | Native vault search over `*.md` notes (hybrid query · lex · vector · reindex · …) — see [search.md](search.md) |
| `mcp` | Serve OneBrain over MCP (stdio) — see [mcp.md](mcp.md) |

## Session Management

| Command | Purpose |
|---|---|
| `session` | Session lifecycle (init) |
| `checkpoint` | Auto-save management (stop · reset · orphans) |

## Launch Management

| Command | Purpose |
|---|---|
| `harness` | Detect or run an AI harness (claude / gemini) |
| `serve` | Serve the local web UI + vault JSON API — see [webui.md](webui.md) |
| `skill` | Skill invocation |

## Global flags

`--vault <PATH>`, `-o/--output <text|json|yaml>` (plus `--json`/`--yaml` shorthands), `--pretty`, `--no-color`, `-q/--quiet`, `-h/--help`, `-V/--version` — accepted by every subcommand.

## Notes

Full per-command reference (every flag, subcommand, and example) lives in the [onebrain-cli README](https://github.com/onebrain-ai/onebrain-cli) — this page is a map, not a duplicate.

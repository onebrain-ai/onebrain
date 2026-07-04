# OneBrain Docs

Deep-dive documentation for OneBrain — the README covers the why and the quickstart; these pages cover the how.

## Get started

| Page | What's inside |
|------|---------------|
| [Install](install.md) | How to install OneBrain, pick a harness, and set up optional extras. |

## Features

| Page | What's inside |
|------|---------------|
| [Web UI](webui.md) | `onebrain serve` runs an embedded web UI and JSON API over your vault — no separate install. |
| [Search](search.md) | `onebrain search` is OneBrain's native hybrid search over your vault's `*.md` notes — lexical (BM25) and semantic (vector) search, RRF-fused, no external service required. |
| [MCP Server](mcp.md) | `onebrain mcp` serves OneBrain over the Model Context Protocol (stdio) — search tools today, more vault tool groups to come *(planned)*. |
| [Memory](memory.md) | How OneBrain's four-tier memory system works, how knowledge gets promoted between tiers, and what saves automatically. |
| [Skills reference](skills.md) | OneBrain ships 30 skills (plus `/help` to list them in-session) — grouped below by workflow phase. |
| [Scheduling](scheduling.md) | Run OneBrain skills automatically on a recurring or one-shot schedule via your OS scheduler. |

## Reference

| Page | What's inside |
|------|---------------|
| [Vault Structure](vault-structure.md) | The folder layout OneBrain creates in your vault, and the task syntax it writes. |
| [CLI Command Map](cli.md) | One-line orientation to every top-level `onebrain` command, grouped as the CLI's own `--help` groups them. |

Questions or gaps? [Open an issue](https://github.com/onebrain-ai/onebrain/issues).

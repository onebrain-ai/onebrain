# Search

`onebrain search` is OneBrain's native hybrid search over your vault's `*.md` notes — lexical (BM25) and semantic (vector) search, RRF-fused, no external service required.

> Part of [OneBrain docs](../README.md)

## Quick start

```bash
onebrain search query "what did I decide about X"   # hybrid: lex + vector, RRF-fused
onebrain search search "exact keyword phrase"        # lexical (BM25) only — never downloads a model
onebrain search vsearch "similar meaning to this"    # semantic (vector) only
onebrain search status                               # index health — never downloads a model
onebrain search reindex                              # rebuild the index (whole vault or specific paths)
```

## Commands

| Command | Purpose |
|---|---|
| `query` | Hybrid search (lex + vector, RRF-fused) |
| `search` | Lexical (BM25) only — never triggers a model download |
| `vsearch` | Semantic (vector) only |
| `get` | Fetch a doc's full indexed text |
| `status` | Report index status (collection, embed model, cache dir, index size) |
| `reindex` | Reindex the vault's `*.md` notes — whole vault, or specific doc paths; `--force` wipes and rebuilds from scratch |
| `model` | Manage the embedding model — `list` (supported models + download/disk status), `set` (switch + persist to `onebrain.yml`, re-embeds), `remove` (delete a cached model's files) |

Shared flags on `query` / `search` / `vsearch`: `--top-k <N>` (default 10), `--min-score <S>` (scale differs per verb — BM25 for `search`, cosine similarity for `vsearch`, RRF rank score for `query`).

Only Markdown files are indexed; other file types in the vault are never touched.

## Configuration

`onebrain.yml`:

```yaml
search:
  collection: my-vault-abc123
```

- `search.collection` is the canonical key. The legacy top-level `qmd_collection` is still honored as a fallback.
- If neither key is set, search is disabled — `onebrain search reindex` exits silently.
- Embedding model is chosen per-vault via `onebrain search model set <name>` (persisted to `onebrain.yml`), not a plain YAML key — check current selection with `onebrain search status`. `multilingual-e5-small` is the registry default for new setups; other supported models include `multilingual-e5-base`, `multilingual-e5-large`, `bge-m3`, and two `embeddinggemma-300m` variants — run `onebrain search model list` for size/dimension/Thai-accuracy tradeoffs.

## qmd → native search migration

Earlier versions of OneBrain shipped search via an external npm package (`@tobilu/qmd`) wrapped by a `/qmd` plugin skill. As of the v3.4.5 cutover:

- The `/qmd` plugin skill is **removed**. Search-index management now lives entirely in the CLI (`onebrain search reindex` / `search status` / `search model`) — no plugin skill wraps it.
- MCP tool names moved from `mcp__plugin_onebrain_qmd__*` to `mcp__plugin_onebrain_search__*`. The `.mcp.json` server key changed from `qmd` to `search`; the underlying command is unchanged (`onebrain mcp`).
- The CLI still ships a separate `onebrain qmd` subcommand (`embed` / `status` / `reindex`) — this is a legacy/internal surface (its `reindex` verb doc even says "replaces v3.0 `qmd-reindex`") and some internal wiring (a session-init JSON field, a PostToolUse hook name) still says "qmd" for backward compatibility. New setups and all documented workflows should use `onebrain search ...`, not `onebrain qmd ...`.

## Troubleshooting

- **`search status` shows "not downloaded"** — the selected embedding model hasn't been fetched yet. It downloads on first `reindex` (or via `onebrain search model set`).
- **No semantic results** — `query`/`vsearch` need an embedded index; `search` (lexical) works without one. Run `onebrain search reindex` to embed.
- **Index looks stale after bulk edits** — run `onebrain search reindex --force` to wipe and rebuild from scratch (downloaded models are kept).

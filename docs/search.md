# Search

`onebrain search` is OneBrain's native hybrid search over your vault's `*.md` notes — lexical (BM25) and semantic (vector) search, RRF-fused, no external service required.

> Part of [OneBrain docs](README.md)

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
  collection: my-vault-1a2b3c   # index collection id (set by setup)
  embed_model: multilingual-e5-base   # optional — overrides the registry default (multilingual-e5-small)
  exclude:                      # optional — folders left out of the index
    - attachments
    - 06-archive
```

`exclude` is honored by indexing, reindex, and `search status` drift checks.

- `search.collection` is the canonical key.
- If neither key is set, search is disabled — `onebrain search reindex` exits silently.
- Embedding model can be set either with `onebrain search model set <name>` (which persists it to `onebrain.yml`) or by writing `search.embed_model:` directly in `onebrain.yml`; the registry default is `multilingual-e5-small`. Check current selection with `onebrain search status`. Other supported models include `multilingual-e5-base`, `multilingual-e5-large`, `bge-m3`, and two `embeddinggemma-300m` variants — run `onebrain search model list` for size/dimension/Thai-accuracy tradeoffs.

## Troubleshooting

- **`search status` shows "not downloaded"** — the selected embedding model hasn't been fetched yet. It downloads on first `reindex` (or via `onebrain search model set`).
- **No semantic results** — `query`/`vsearch` need an embedded index; `search` (lexical) works without one. Run `onebrain search reindex` to embed.
- **Index looks stale after bulk edits** — run `onebrain search reindex --force` to wipe and rebuild from scratch (downloaded models are kept).

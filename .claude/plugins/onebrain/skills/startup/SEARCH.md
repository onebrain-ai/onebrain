# Search Guide

## Search Strategy

When the search MCP tools are available (look for `mcp__plugin_onebrain_search__query` in your tool list), **the search tools are the default for vault content search** — not Grep. Reach for Grep only when the query is genuinely about exact text matches inside a known file.

**search-first decision rule:**

| Question type | Tool |
|---|---|
| "Find notes about <topic>" / "what did I write about X" / topic exploration | `mcp__plugin_onebrain_search__query` |
| "Notes related to / similar to Y" | `mcp__plugin_onebrain_search__query` (vec/hyde sub-queries) |
| "Where did I capture <fuzzy concept>" | `mcp__plugin_onebrain_search__query` |
| "Get me the content of <known path>" | `mcp__plugin_onebrain_search__get` / `multi_get` |
| "Does file X exist" / known glob pattern | `Glob` |
| "Check frontmatter field on <known file>" | `Read` |
| "Find all `- [ ] ` task lines in projects/" | `Grep` (structural pattern, not content search) |
| "Find exact string `MIN_ACTIVITY` in src/" | `Grep` (code search, not vault content) |

**Common anti-pattern to avoid:** running `Grep` over `03-knowledge/` or `04-resources/` to find notes about a topic. That is a content search — use the search tools. Grep returns line matches, the search tools return ranked documents with snippets and are what was designed for that question.

**Sub-query types** (pass to `searches` parameter):
- `lex` — BM25 keyword search (exact terms, fast)
- `vec` — semantic vector search (meaning-based; requires embeddings)
- `hyde` — hypothetical document (write what the answer looks like; requires embeddings)
- Combine `lex` + `vec` for best results: `[{type:'lex', query:'error'}, {type:'vec', query:'error handling best practices'}]`
- Always pass `intent` to disambiguate and improve snippets.

**When the search tools are not available** (not installed or not set up), use Glob/Grep/Read as normal — this is the default and requires no special handling.

Without embeddings, `mcp__plugin_onebrain_search__query` uses BM25 keyword search only. To enable semantic/similarity search (finding conceptually related notes, not just keyword matches), the index must be embedded at least once — run `onebrain search reindex`. Suggest this if the user asks for similarity-based or "related notes" queries and the search tools are available but embeddings haven't been run.

## Index Maintenance

Whenever you add, edit, or delete any file in the vault, check first whether the search tools are available by looking for `mcp__plugin_onebrain_search__query` in your tool list. If they are available, immediately run:

```
onebrain search reindex
```

This triggers a background reindex. The command reads `qmd_collection` from onebrain.yml and exits silently if the search index is not installed or the collection is not set. It is fire-and-forget — no need to wait for it to complete.

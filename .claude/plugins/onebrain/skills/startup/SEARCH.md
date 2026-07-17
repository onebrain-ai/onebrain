# Search Guide

## The Cascade

Any vault **content** search — topic lookup, "find notes about X", "what did I write about Y", related-notes discovery, fuzzy-concept recall — follows this cascade, in order. This does NOT apply to known-path reads, structural pattern scans (task lines, frontmatter keys, wikilink scans), or code/config greps — see the decision table below for those.

1. **MCP query first, always.** Call `mcp__plugin_onebrain_search__query` with `lex` + `vec` sub-queries (add `hyde` for fuzzy/conceptual asks) and an `intent` string. This is the default entry point for every content search — never start with Grep.

2. **Judge confidence via `rerank_score`** (0–1, per hit):
   - **`< 0.30`** — no strong match. Treat as equivalent to zero hits.
   - **`0.30 – 0.60`** — possible match. Usable, but don't present as settled fact.
   - **`≥ 0.60`** — confident match. Safe to cite directly.

3. **Fall back to Grep only when one of these holds:**
   - MCP tool is unavailable (not in tool list) or returns an error.
   - Zero hits, or every hit scores `< 0.30`.
   - **Freshness gap** — the file was written or edited this same turn/session and the index hasn't caught up yet. This is the most common legitimate fallback trigger; don't second-guess it.

   When falling back after a genuine MCP miss, append the alternation branch `|mcp-miss` to the Grep `pattern` (canonical form: `real-pattern|mcp-miss` — the alternation is regex-harmless, whereas a non-alternated literal append would change the pattern's semantics and silently kill matches). This is the documented escape hatch the PreToolUse grep-gate hook scans the pattern for, to let the fallback through without treating it as an anti-pattern. Do not add this token speculatively; only after step 1–2 actually produced a miss, and only when the Grep target is otherwise inside the vault's content folders (the hook doesn't gate anything outside them regardless).

4. **Grep also comes back empty (or isn't applicable) → honest "not found."** Never pad a low-confidence MCP result into an answer just because Grep didn't help either. Say plainly that nothing matched.

5. **Silence rule.** Never narrate which method produced the answer. No "I searched with MCP first," no "falling back to grep," no "the index was stale so I used Grep instead." Deliver only the results (or the honest not-found). The cascade is implementation detail, not user-facing content.

6. **Self-healing on freshness-gap fallback.** If step 3's trigger was specifically the freshness gap (file written this turn, not yet indexed), silently fire `onebrain search reindex --pending-only` in the background (fire-and-forget, don't wait on it) so the next query in this session doesn't need the same fallback. Engine contention across concurrent callers is already handled by the CLI's own warm per-vault daemon (v3.4.13+) — no plugin-side handling needed for that case.

## Search Strategy — Tool Selection

When the search MCP tools are available (look for `mcp__plugin_onebrain_search__query` in your tool list), **the search tools are the default for vault content search** — not Grep. Reach for Grep only per the cascade fallback triggers above, or for the genuinely non-content lookups in the table below.

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

**Common anti-pattern to avoid:** running `Grep` over `03-knowledge/` or `04-resources/` to find notes about a topic without having tried MCP first. That is a content search — the cascade requires MCP query as step 1. Grep returns line matches, the search tools return ranked documents with snippets and calibrated `rerank_score` confidence, and are what was designed for that question.

**Sub-query types** (pass to `searches` parameter):
- `lex` — BM25 keyword search (exact terms, fast)
- `vec` — semantic vector search (meaning-based; requires embeddings)
- `hyde` — hypothetical document (write what the answer looks like; requires embeddings)
- Combine `lex` + `vec` for best results: `[{type:'lex', query:'error'}, {type:'vec', query:'error handling best practices'}]`
- Always pass `intent` to disambiguate and improve snippets.

**When the search tools are not available** (not installed or not set up), use Glob/Grep/Read as normal — this is the default and requires no special handling. The cascade and rerank_score bands only apply when the MCP tool is present.

Without embeddings, `mcp__plugin_onebrain_search__query` uses BM25 keyword search only. To enable semantic/similarity search (finding conceptually related notes, not just keyword matches), the index must be embedded at least once — run `onebrain search reindex`. Suggest this if the user asks for similarity-based or "related notes" queries and the search tools are available but embeddings haven't been run.

## Index Maintenance

Whenever you add, edit, or delete any file in the vault, check first whether the search tools are available by looking for `mcp__plugin_onebrain_search__query` in your tool list. If they are available, immediately run:

```
onebrain search reindex
```

This triggers a background reindex. The command reads `search.collection` from onebrain.yml (falling back to the legacy top-level `qmd_collection` when unset) and exits silently if the search index is not installed or the collection is not set. It is fire-and-forget — no need to wait for it to complete.

For the narrower freshness-gap case handled inline during the cascade (step 6 above), prefer `onebrain search reindex --pending-only` — it's the same fire-and-forget contract but scoped to unembedded/pending docs rather than a full reindex.

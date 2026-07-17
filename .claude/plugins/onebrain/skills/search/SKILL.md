---
name: search
description: General vault retrieval — answers both "what" and "why" questions across MEMORY.md, memory/, session logs, project trackers, and vault notes. Uses the search tools (lex+vec+hyde) with grep fallback.
auto-invoke:
  - "search vault"
  - "find in vault"
  - "why did"
schedulable_with_args: true
required_args: [query]
---

# /search — General vault retrieval

## Purpose

First-class retrieval skill that answers both **what** and **why** questions across all knowledge layers in the OneBrain vault.

Distinct from existing skills:
- `/distill` synthesizes a topic into a *new persisted note* (write); /search is read-only
- `/recap` promotes session insights to *memory/* (write); /search is read-only
- A direct search query gives content matches; /search ranks by question type and surfaces decision chains

## Sources searched (in order of relevance)

1. `[agent_folder]/MEMORY.md` — always-loaded persona/active-projects
2. `[agent_folder]/memory/*.md` — match via MEMORY-INDEX topics
3. `[logs_folder]/session/**/*-session-*.md` — past session logs
4. `[projects_folder]/**/*.md` — project notes including embedded specs/plans/design docs
5. Project tracker decisions log tables (project MOCs under `[projects_folder]/`)
6. Vault notes (`[knowledge_folder]/`, `[resources_folder]/`, `[areas_folder]/`)
7. `[logs_folder]/checkpoint/*.md` — in-session-state recovery (for current-day questions)

## Tools used

- **Search tools lex+vec+hyde** if `search.collection` is configured in onebrain.yml (legacy top-level `qmd_collection` still honored) (preferred) — follows the cascade in `skills/startup/SEARCH.md`
- **Glob + Grep fallback** per the cascade's fallback triggers, or unconditionally if the search tools are unavailable
- **Heuristic question-type detection**: matches `^why\b` (or the agent's bilingual intent inference on non-English equivalents) → "why mode"; else → "what mode"

## Confidence

Every MCP hit carries a `rerank_score` (0–1). Apply the cascade's bands when composing the answer:
- **`> 0.60`** — confident; cite directly in the direct answer / decision chain.
- **`0.30 – 0.60`** — possible; include only in the Sources list, not folded into the direct-answer synthesis as settled fact.
- **`< 0.30`** — no strong match; drop it. If, after the cascade's Grep fallback, nothing clears `0.30`, output an honest **no strong match** result instead of stitching noise into an answer (see Output format below).

## Output format — what mode

For "what is X" / "what's the current state of X" questions, synthesize a direct answer + cite top 5 sources:

```
📌 Direct answer (1–3 sentences synthesized from sources)

📚 Sources (top 5 by relevance):
  1. <file path>:<heading> — <1-line excerpt>
  2. ...
```

**No strong match** (all candidates scored below 0.30 and the cascade's Grep fallback found nothing either):

```
🔴 No strong match for "<query>" — nothing in the vault clears the confidence bar.
```

## Output format — why mode

For "why did X" / "why is X" questions, reconstruct chronological decision chain:

```
🕐 Decision chain (chronological):
  YYYY-MM-DD · <event/decision> · "<key quote or rationale>"
  YYYY-MM-DD · <next event> · "<rationale>"
  ...

📚 Sources: <list of files referenced in chain>
```

## Skill flow

1. Detect question type from input (`why` keyword or default to `what`)
2. Run the cascade: search query (lex+vec+hyde) first, Grep only on a cascade fallback trigger
3. Score results by question type (why → emphasize sessions + decisions logs; what → emphasize knowledge + project notes), applying the confidence bands above
4. Top-K cap: 5 results by default; `--all` flag returns full ranked list
5. Format per mode above

## Known limitations

- Search quality depends on search index freshness — run `onebrain search reindex` if recent vault changes not reflected
- Why mode requires chronological events to exist; if no decision history found, falls back to what-mode output with a note

## Progress reporting

This skill is long-running for large vaults. Emit:

```
→ [step 1/4] detecting question type · routing to search...
→ [step 2/4] running search lex+vec+hyde across all sources...
→ [step 3/4] scoring + ranking results...
→ [step 4/4] formatting answer...
```

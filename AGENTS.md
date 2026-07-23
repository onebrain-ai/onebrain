# OneBrain — Codex CLI

OneBrain is a personal AI OS built on a plain-Markdown vault — use its built-in web UI. INSTRUCTIONS.md is written using Claude Code
tool names — the mapping below translates them to Codex CLI equivalents and explains
how to dispatch sub-agents for skills that require parallel execution.

## Load Order

1. **Tool mapping** — translates Claude Code tool names to Codex CLI equivalents, and maps `Agent` dispatch to `spawn_agent`
2. **Shared agent instructions** — vault structure, skills, session behavior, and personality

## Tool Name Mapping

@.claude/plugins/onebrain/references/codex-tools.md

Read `.claude/plugins/onebrain/references/codex-tools.md` completely before
using any OneBrain workflow. The `@` line above is documentation, not a
guarantee that the Codex host expands file imports.

## Agent Instructions

@.claude/plugins/onebrain/INSTRUCTIONS.md

Then read `.claude/plugins/onebrain/INSTRUCTIONS.md` completely and apply its
vault configuration and session rules. Do not rely on `@file` expansion alone.

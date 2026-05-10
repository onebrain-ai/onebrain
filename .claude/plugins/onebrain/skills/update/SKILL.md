---
name: update
description: "Update OneBrain system files from GitHub to the latest version. Use when the user wants to pull the latest OneBrain skills, hooks, and agents — 'update OneBrain', 'pull latest version'. Do NOT use for: updating vault notes (edit directly), teaching memory (use learn), or vault health checks (use doctor)."
---

# Update

Update OneBrain system files from GitHub to the latest version.

## Version Check

1. Read current version from vault's `plugin.json` (`[agent_folder]/../../.claude-plugin/plugin.json` or `.claude/plugins/onebrain/.claude-plugin/plugin.json`)
2. Read `update_channel` from `vault.yml` (default: `stable` if field absent).
   Map to GitHub branch:
   - `stable` → `main`
   - `next` → `next`
   - `N.x` (e.g. `1.x`, `2.x`) → `N.x`
3. Read new version from repo's `plugin.json` on the mapped branch using `WebFetch` — never use `git` commands (they hang on Windows waiting for credentials):
   `https://raw.githubusercontent.com/onebrain-ai/onebrain/{branch}/.claude/plugins/onebrain/.claude-plugin/plugin.json`
   where `{branch}` is the mapped branch from step 2.
   Parse the `version` field from the JSON response.
4. If equal → say: ✅ Already up to date — v{X.X.X}. and stop
5. If newer → WebFetch `https://raw.githubusercontent.com/onebrain-ai/onebrain/{branch}/PLUGIN-CHANGELOG.md`; display before proceeding (do not skip or summarize):

   ```
   ──────────────────────────────────────────────────────────────
   🔄 Update Available — v{current} → v{new}
   ──────────────────────────────────────────────────────────────
   {changelog entry verbatim}
   ```

   Then AskUserQuestion: "Update to v{new}?" Options: update / cancel

### Major Version Bump Guard

If `new_major > current_major` (e.g. vault is v1.10.0, repo branch has v2.0.0):
→ AskUserQuestion: "Major version bump detected (v{current} → v{new}) — this may include breaking changes. Proceed with update?"
Options: `update / cancel`
→ If cancel: stop immediately, no changes made
→ If update: proceed with normal confirmation flow below

Minor/patch bumps (1.10.0 → 1.10.1, 1.10.0 → 1.11.0): proceed without major version prompt.

6. AskUserQuestion: "Update to vX.X.X?"
   Options: `update / cancel`
7. If confirmed → proceed to bootstrap below

## CLI Version Check

After confirming the vault update (step 7 above), also bring the installed `onebrain` CLI up to date by delegating to the CLI's own update path.

1. **Probe whether `onebrain` is on PATH.** Use the form matching the active shell. `Get-Command` always exits 0, so on PowerShell interpret presence by stdout content (a non-empty `CommandInfo` line = present), not by exit code:
   - **Bash / zsh / Git Bash:** `onebrain --version 2>/dev/null` — non-zero exit = not installed.
   - **PowerShell:** `Get-Command onebrain -ErrorAction SilentlyContinue` — empty stdout = not installed.
   - **cmd:** `where onebrain 2>nul` — non-zero exit = not installed.

   If not installed, skip this section entirely — the CLI cannot self-update if it isn't installed; first-time CLI install lives in the README, not here.

2. Run `onebrain update`. The CLI handles everything: version comparison against the GitHub releases API, package-manager choice (`bun` on macOS/Linux, `npm` via PowerShell on Windows), install, and post-install binary validation. If already current it prints `Already up to date — @onebrain-ai/cli vX.Y.Z` and exits 0; no further action.

3. If `onebrain update` exits non-zero, surface its captured output (both stdout and stderr) verbatim to the user — `runUpdate` writes the human-readable step lines to stdout and the final error tag to stderr, so showing only stderr would hide the diagnostic context. Then continue with the rest of `/update` — CLI failure does not block the vault sync that already completed (and re-running `/update` retries the CLI bump idempotently).

> **Why one command instead of a prompt.** `onebrain update` is the canonical CLI-update path. Duplicating its logic here (raw `npm view` + AskUserQuestion + `npm install -g`) would drift from the CLI's own version check and validation gates. The user already confirmed `/update` at step 6; the CLI bump rides on that confirmation.

## Self-Update Bootstrap (Read-New, Execute-In-Place)

Skills are markdown instructions — the agent can read the new SKILL.md from GitHub and
follow it as instructions in the same conversation. No re-invoke needed.

GitHub raw URL template: `https://raw.githubusercontent.com/onebrain-ai/onebrain/{branch}/.claude/plugins/onebrain/{path}`
where `{branch}` is the branch mapped from `update_channel` in step 2 of Version Check.

Steps:
1. **Early bootstrap — download the latest SKILL.md:**
   Use WebFetch + Write to download this file from GitHub and write to vault. `{vault_root}` = the vault's absolute path (the current working directory — the directory containing `.claude/`).

   Raw URL: `https://raw.githubusercontent.com/onebrain-ai/onebrain/{branch}/.claude/plugins/onebrain/{path}`

   Download and write:
   - `skills/update/SKILL.md`

   Path relative to `[vault]/.claude/plugins/onebrain/`.

2. Read the newly-written `[vault]/.claude/plugins/onebrain/skills/update/SKILL.md` into agent context. Follow THESE instructions (not the pre-update copy) for all remaining steps.
3. Execute migration in this order:
   **0. 07-logs structure migration (one-shot, idempotent)** — run BEFORE backup.
   **Detect** (handles partial-state resume — `session/` may exist from a prior interrupted run): if `[logs_folder]/YYYY/MM/` contains ANY of `*-session-*.md`, `*-checkpoint-*.md`, or `*-update-*.md` files (recursive glob across all `YYYY/MM/` subdirectories), trigger migration regardless of whether `[logs_folder]/session/` already exists. Only skip migration entirely when no recognizable legacy log files remain in `[logs_folder]/YYYY/MM/`. This way, an interrupted migration re-runs and finishes the move; a clean post-migration vault is a no-op.
   Migration steps (only when triggered):
   1. **Snapshot counts** ก่อน move:
      - `session_count` = count of `[logs_folder]/YYYY/MM/*-session-*.md` recursively
      - `checkpoint_count` = count of `[logs_folder]/YYYY/MM/*-checkpoint-*.md` recursively
      - `update_count` = count of `[logs_folder]/YYYY/MM/*-update-*.md` recursively
   2. **Create new layout** (4 folders, per-shell — bash brace expansion is bash/zsh-only, not portable):
      - **Bash / zsh**: `mkdir -p [logs_folder]/{session,checkpoint,update,log}`
      - **PowerShell**: `'session','checkpoint','update','log' | ForEach-Object { New-Item -ItemType Directory -Force -Path "[logs_folder]/$_" | Out-Null }`
      - **Cross-shell (preferred)**: `node -e "['session','checkpoint','update','log'].forEach(d => require('fs').mkdirSync(require('path').join('[logs_folder]', d), { recursive: true }))"`
   3. **Move files** (`mv` — atomic within same volume; iCloud Drive vault is one volume):
      - `*-session-*.md` → `[logs_folder]/session/YYYY/MM/` (preserve YYYY/MM nesting; `mkdir -p` per file)
      - `*-checkpoint-*.md` → `[logs_folder]/checkpoint/` (**flatten**, drop YYYY/MM)
      - `*-update-*.md` → `[logs_folder]/update/` (**flatten**, drop YYYY/MM)
      - **Unknown `.md` files** (no recognized type pattern) → flag warning + skip move (left in legacy location for user review)
      - `.gitkeep`, `.DS_Store` → ignore in old location (cleanup step removes them).
   4. **Cleanup old structure**: remove now-empty `[logs_folder]/YYYY/MM/`, `[logs_folder]/YYYY/`. Skip removal if directory is non-empty (unknown files remained). Remove stray `.DS_Store`. Keep `[logs_folder]/.gitkeep`.
   5. **Verify counts**: post-move recursive count under each new subfolder must match the snapshot. If mismatch → **abort `/update` entirely** with the diff (counts before/after) and the list of files left in legacy. Do NOT proceed to Step 4 below (no migration log written; the next `/update` run will re-detect the partial state via Step 0's trigger and resume). User decides whether to roll back manually (no automatic rollback — files are intact, just folder structure differs).
   6. **Buffer migration counts in memory** (do NOT write a log file here — Step 4 below owns the update log file). Buffer:
      ```
      session: N files moved (preserve YYYY/MM)
      checkpoint: N files moved (flatten)
      update: N files moved (flatten)
      Old YYYY/MM folders removed: N
      Unknown .md files left in place: N (list paths if any)
      ```
      Step 4 below appends these as a `## Migration: 07-logs restructure` section inside the update log it writes to `[logs_folder]/update/YYYY-MM-DD-update-vX.Y.Z.md`. This avoids two skills writing to the same file in the same run.

   a. Pre-migration backup: copy `[agent_folder]/MEMORY.md` → `[archive_folder]/05-agent/MEMORY-YYYY-MM-DD.md`
      and `[agent_folder]/context/` → `[archive_folder]/05-agent/context.YYYY-MM-DD/` (if context/ exists)
   b. Sync remaining files — run these two sub-steps in parallel, then clean cache after both complete:
      - **Full vault sync:** run `onebrain vault-sync --branch {branch}` (the CLI defaults the vault root to the current working directory; explicit `"$PWD"` was Bash-only and broke on PowerShell/cmd). Downloads the full GitHub tarball, syncs plugin folder (with stale file cleanup), copies README.md/CONTRIBUTING.md/CHANGELOG.md/PLUGIN-CHANGELOG.md to vault root (overwrite), merges CLAUDE.md/GEMINI.md/AGENTS.md (vault is primary; injects new repo `@` imports only), pins plugin to vault, and clears plugin cache.
      - **Settings merge:** WebFetch `https://raw.githubusercontent.com/onebrain-ai/onebrain/{branch}/.claude/settings.json`, then merge into `[vault]/.claude/settings.json`. Merge strategy (never overwrite, always additive): `permissions.allow` → union; `enabledPlugins` → merge keys (skip any `onebrain@*` key whose marketplace points to a `directory` source — repo-dev-only, not valid in vault context); `extraKnownMarketplaces` → skip (repo-dev-only config, not valid in vault context); `hooks` → skip (handled by migration Step 6).
   c. Once all step 3b sub-steps are complete, load `[vault]/.claude/plugins/onebrain/skills/update/references/migration-steps.md` and run all 8 migration steps
   d. Bump `plugin.json` version to `{new}` (last — completion signal; do not bump early)
4. Write migration log to `[logs_folder]/update/YYYY-MM-DD-update-vX.X.X.md` (post-v2.4.0: flat directory, no YYYY/MM). **Create the `update/` directory if missing** (`mkdir -p [logs_folder]/update` or per-shell equivalent) — fresh post-v2.4.0 vaults that never ran the migration won't have the dir yet, so Step 4 must self-bootstrap.

   ```markdown
   ---
   tags: [update-log]
   date: YYYY-MM-DD
   from_version: X.X.X
   to_version: X.X.X
   ---

   # Update Log — vX.X.X → vX.X.X

   ## Steps Completed

   - [x] Step 1: Migrated N Key Learnings → memory/ (N behavioral, N project)
   - [x] Step 2: Migrated context/ → memory/ (N files)
   - [x] Step 3: Updated frontmatter on N memory/ files
   - [x] Step 4: Restructured MEMORY.md → 3 sections
   - [x] Step 5: Created MEMORY-INDEX.md (N active entries)
   - [x] Step 6: Registered Stop hook; removed stale onebrain entries from any other event (PreCompact, PostCompact, etc.) (+ PostToolUse qmd hook if qmd_collection set)
   - [x] Step 7: /doctor — N issues
   - [x] Step 8: Initialized vault.yml stats + recap block

   ## Summary

   N files created, N modified, N deleted.
   ```

   - Mark each step `[x]` on completion; leave `[ ]` if skipped (with reason)
   - If a step had nothing to do (e.g. context/ already absent), write `[x] Step 2: Skipped — context/ not present`
   - If /doctor found issues in Step 7, list them under the step line
   - **If Step 0 (07-logs structure migration) completed successfully** (sub-step 6 buffer exists), append the buffered counts as a `## Migration: 07-logs restructure` section after `## Summary`. If Step 0 aborted at sub-step 5 (count mismatch), this Step 4 must not run at all — the abort halts `/update` before reaching here:
     ```
     ## Migration: 07-logs restructure

     - session: N files moved (preserve YYYY/MM)
     - checkpoint: N files moved (flatten)
     - update: N files moved (flatten)
     - Old YYYY/MM folders removed: N
     - Unknown .md files left in place: N (list paths if any)
     ```
     Skip this section entirely if Step 0 was a no-op (clean post-migration vault).

5. Report summary to user:

   For each migration step (one line per step):
   ✅ Step {N}: {description} ({N} files)
   ✅ Step {N}: Skipped — {reason}
   🟡 Step {N}: {description} — {N} issues (see above)

   Completion:
   ✅ OneBrain updated to v{new}. {N} files created, {M} modified.

## --dry-run Mode

`/update --dry-run` → run all steps WITHOUT writing. Display for each step:
```
──────────────────────────────────────────────────────────────
🔄 Dry Run — v{current} → v{new}
──────────────────────────────────────────────────────────────
Would create: `[logs_folder]/update/YYYY-MM-DD-update-vX.X.X.md`
Would modify: `[agent_folder]/MEMORY.md` — remove Key Learnings section
Would create: `[agent_folder]/memory/kebab-topic.md`
Would delete: `[agent_folder]/context/`
```
The version check, changelog display, and AskUserQuestion confirmation still happen normally in dry-run mode. No files are written, moved, or deleted. At the end say:
Dry run complete — {N} files would be created, {M} modified, {P} deleted.

## Failure Recovery

- Version stays old until plugin.json bump (step 3d) — re-running /update retries from start
- Re-running /update from the start is safe — `onebrain vault-sync` downloads fresh and overwrites (idempotent)
- If vault in unrecoverable state: restore from backup in `[archive_folder]/`, then re-run /update

---

## Known Gotchas

- **Do not use git commands for the version check.** `git fetch` and `git pull` hang on Windows while waiting for credentials. Always use `WebFetch` on the raw GitHub URL to compare versions and fetch files.

- **plugin.json bump is the last step.** If /update is interrupted before step 3d, the version stays at the old number — re-running /update will retry the full migration. Do not bump plugin.json early as a progress marker.

- **MEMORY.md Key Learnings migration (migration Step 1) must run before migration Step 4.** Migration Step 4 restructures MEMORY.md; migration Step 1 reads and extracts from it. Running them in the wrong order loses the Key Learnings content before it can be promoted to memory/ files.

- **Plugin folder sync deletes stale files.** Step 3b removes files in the vault's plugin folder that no longer exist in the GitHub repo. This is intentional — the GitHub repo is the single source of truth. Do not place user customizations inside `.claude/plugins/onebrain/`; they belong at the project or user settings level.

- **Harness file merge is vault-primary.** If a user removed a plugin `@` import from CLAUDE.md/GEMINI.md/AGENTS.md (e.g., `@.claude/plugins/onebrain/INSTRUCTIONS.md`), `/update` will re-inject it on the next run because the script cannot distinguish intentional deletion from never having had it. If a specific import should stay absent, re-remove it after updating.

- **Root files live at the repo root, not the plugin folder.** `onebrain vault-sync` handles all seven root-level files: README.md, CONTRIBUTING.md, CHANGELOG.md, PLUGIN-CHANGELOG.md (simple overwrite) and CLAUDE.md, GEMINI.md, AGENTS.md (merge — preserves user `@` imports). Never copy any of these into the plugin folder.

- **Failure recovery path:** If interrupted before step 3d (plugin.json bump), re-running /update will retry from step 1. The early bootstrap (download SKILL.md) is idempotent — safe to repeat.

- **CLI update delegates to `onebrain update`.** Do not call `npm install -g @onebrain-ai/cli` or `bun install -g @onebrain-ai/cli` from this skill — `onebrain update` is the single source of truth for the CLI bump (version check, package-manager choice, validation). Raw npm/bun is reserved for first-time CLI bootstrap, which is a README/install-script concern, not a `/update` concern.

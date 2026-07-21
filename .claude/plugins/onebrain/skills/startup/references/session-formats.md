---
name: session-formats
description: "Canonical templates for checkpoint files and session log files. Referenced by INSTRUCTIONS.md, wrapup/SKILL.md, and startup/AUTO-SUMMARY.md. All variants share the same body sections."
---

# Session File Formats

Shared canonical templates. Referenced by:
- `INSTRUCTIONS.md` — stop checkpoint writes
- `skills/wrapup/SKILL.md` — /wrapup session log (Step 4) + orphan recovery (Step 1b)
- `skills/startup/AUTO-SUMMARY.md` — auto-saved session log

**Never add `recapped:` or `topics:` to any session log frontmatter** — these fields are set exclusively by /recap. Writing them here causes /recap to silently skip the log.

---

## Shared Body Sections

Both checkpoint files and session log files use these sections in order:

```markdown
## What We Worked On

[see per-format note below]

## Key Decisions

- [bullet list of decisions made]

## Insights & Learnings

- [new understanding, patterns, discoveries — omit section if none]

## What Worked / Didn't Work

- ✅ [something that worked]
- ❌ [something that didn't — omit section if no notable friction]

## Action Items

- [ ] [task] 📅 YYYY-MM-DD

## Open Questions

- [unresolved questions]
```

---

## Checkpoint Format

Written by the Stop hook. Keep under 250 words total.

**Frontmatter:**
```yaml
---
tags: [checkpoint, session-log]
date: YYYY-MM-DD
session_token: <token>
checkpoint: NN
trigger: stop
---
```

`session_token` is the same token embedded in the filename — duplicating it in frontmatter lets `/wrapup`, `/doctor`, and `checkpoint orphans` filter checkpoints by token without parsing filenames. The agent (per `INSTRUCTIONS.md` Auto Checkpoint section) sets this from the `session_token` already in context (recovered via `onebrain session init` if missing).

**Body:** use Shared Body Sections above. `## What We Worked On`: 2-3 sentences describing the session focus.

**Dataview compatibility:** Never write `` `=… `` (backtick followed by `=`) anywhere in the file — Dataview parses it as an inline query and throws a parse error in Obsidian. Use `→` in place of `==>`, or describe the concept in plain prose instead of quoting it in a code span.

---

## Pause File Format

Written by `/pause` (user-driven snapshot) or auto-finalize before AUTO-SUMMARY / `/wrapup` "n" branch when an active pause thread exists. Filename pattern: `YYYY-MM-DD-{slug}-pause-NN.md` (NN scoped to slug across all dates, not reset per day).

**Frontmatter:**
```yaml
---
tags: [pause, session-log]
date: YYYY-MM-DD
session_token: <token>
task_slug: <kebab-case-slug>
pause: NN
trigger: manual
---
```

- `trigger: manual` — written by `/pause` (default)
- `trigger: auto-finalize` — written automatically before session end when `_active.md` exists and skip conditions don't apply (see `skills/pause/SKILL.md` §Auto-Finalize)

`task_slug` and `pause` mirror the filename so frontmatter-only filters work without parsing filenames.

**Body:** use Shared Body Sections above, PLUS two additional sections at the top:

```markdown
## Where I Stopped

1–2 sentences describing the current state of the work: file being edited, decision pending, last test run.

## Resume With

One concrete action to perform first on resume — specific file path, command, or decision point.

## What We Worked On

[checkpoint section]

## Key Decisions

[bullet list]

## Insights & Learnings

[omit if none]

## Action Items

- [ ] task 📅 YYYY-MM-DD

## Open Questions

[bullet list]
```

**Word cap:** 350 words total (100 more than checkpoint, to accommodate Where I Stopped + Resume With).

**Dataview compatibility:** same rule as Checkpoint Format — never write `` `=… `` anywhere in the file.

---

## Session Log Format

**Header line** (before body sections):
```markdown
# Session Summary : [Month DD, YYYY] (Session N)
```

**Body:** use Shared Body Sections above. `## What We Worked On`: 1-3 sentences describing the session's focus.

### Frontmatter by Case

Use the complete block for the matching case. Do not mix fields from different cases.

**Standard /wrapup — no checkpoints incorporated:**
```yaml
---
tags: [session-log]
date: YYYY-MM-DD
session_token: <token>
session: NN
---
```

**Standard /wrapup — checkpoints incorporated:**
```yaml
---
tags: [session-log]
date: YYYY-MM-DD
session_token: <token>
session: NN
synthesized_from_checkpoints: true
---
```

**Auto-saved (auto-summary) — no checkpoints:**
```yaml
---
tags: [session-log]
date: YYYY-MM-DD
session_token: <token>
session: NN
auto-saved: true
---
```

**Auto-saved (auto-summary) — checkpoints incorporated:**
```yaml
---
tags: [session-log]
date: YYYY-MM-DD
session_token: <token>
session: NN
auto-saved: true
synthesized_from_checkpoints: true
---
```

**Recovered from checkpoints** (used by: /wrapup orphan recovery for prior sessions whose checkpoints were never wrapped up):
```yaml
---
tags: [session-log]
date: YYYY-MM-DD
session_token: <token>
session: NN
synthesized_from_checkpoints: true
auto-recovered: true
consumed:
  - file: YYYY-MM-DD-<token>-checkpoint-NN.md
    sha256: <first 16 hex chars of SHA-256>
---
```

`consumed:` is **required for this case** and is the only thing that authorises /wrapup to delete a checkpoint. One entry per checkpoint whose content this log actually contains, and none for any other. "Required" means the key must be present and must be written from what was actually read — **not** that it must be non-empty: a log whose entries were all legitimately omitted carries an empty list, and /wrapup treats that as "this log preserves nothing", never as a defect. Omitting an entry costs a re-recovery; inventing one destroys a checkpoint. See *Body marker* below for why it is content-addressed rather than numbered.

> **Normative hash definition — every producer and consumer of `sha256` MUST use exactly this.** Hash the
> **raw bytes of the checkpoint file on disk**, whole and unmodified: not the extracted content, not the
> body with frontmatter stripped, not a normalised or re-encoded form. Take the **first 16 characters of
> the lowercase hex digest** (`shasum -a 256 <file>` / `sha256sum <file>`, discarding the trailing filename
> field the tool prints). A value of any other length, or in uppercase, is a malformed entry. This is the
> same definition /wrapup Step 1b step (a) applies when reading the list back; the two must agree exactly or
> every comparison silently fails — and a form that strips the frontmatter date, token or `NN` can make two
> genuinely different files hash *equal* under a reused filename, the one combination that authorises a
> delete.

**Thread wrapup — pause snapshots incorporated** (used by: `/wrapup` Thread Wrapup Branch when user confirms `y` on the active-thread prompt):
```yaml
---
tags: [session-log]
date: YYYY-MM-DD
session_token: <token>
session: NN
synthesized_from_pause: true
pause_slug: <kebab-case-slug>
---
```

`pause_slug` records which thread this log consolidates. Body content merges all pause files of the slug + checkpoint files of the current session into one log, following the Preservation rule from /wrapup Step 4.

`session_token` mirrors the token embedded in the filename so cross-references (orphan recovery's `recovery-of:` marker, /distill source-log filtering, /doctor checks) can match by frontmatter without parsing filenames. Source the token from the `session_token` already in agent context (set by `onebrain session init` at startup); for **Recovered from checkpoints**, source it from the orphan group's parsed token (the same one embedded in the body marker), not the live session's token.

**Body marker (required for this case):** the very first body line — placed before `# Session Summary :` — must be the recovery-of marker:
```markdown
<!-- recovery-of: {token}:{YYYY-MM-DD} -->
```

Where `{token}` is the recovered group's session token (parsed from the checkpoint filenames) and `{YYYY-MM-DD}` is the recovered session's date (the checkpoint files' date prefix, not today). **Emit one marker line per distinct date this log recovered**, on consecutive lines — a group is keyed by token alone, so a session running past midnight puts several dates in one log. **The marker must occupy a full line on its own** — do not embed it inline within prose, do not append text after the closing `-->`. The /wrapup `already-recovered` short-circuit anchors its detection to start-of-line so a session log that quotes the marker as documentation in mid-paragraph cannot trigger a false short-circuit.

**Why a body marker, not just frontmatter:** /wrapup's `already-recovered` short-circuit (Step 1b → Auto-Recover step a) needs a stable, version-independent signal that a given group was already preserved in a prior recovered log. Frontmatter shape has drifted across releases (`auto-recovered: true` here, `case: recovered` in older drafts, `synthesized_from_checkpoints: true` shared with manual wrapups). The body marker is the only signal that:
1. Names the specific token + date pair recovered (frontmatter doesn't), so multi-group recovery logs short-circuit per group rather than as a whole,
2. Survives any future frontmatter-key rename without breaking existing recovered logs,
3. Is greppable by a fast `rg`/`grep` before any YAML parse.

> **🔴 The marker NEVER authorises a delete — `consumed:` does.** The `{token}:{date}` pair proves only
> that **a** recovery happened; it does **not** prove that any particular checkpoint file was preserved. A
> session that keeps running after its checkpoints were recovered writes **more** checkpoints under the same
> token and the same date, and the marker cannot tell those apart from the ones already saved. /wrapup
> therefore deletes a checkpoint only when a `consumed:` entry matches both its filename **and** a re-hash
> of its content.

> **🔴 Why the entry is content-addressed and not a checkpoint number.** A boundary like "everything
> through `NN`" is unsound, because `NN` is not stable: the CLI derives the next number by scanning the
> checkpoint directory (`max_checkpoint_nn` in `onebrain-cli`'s `crates/onebrain-cache/src/checkpoint.rs`,
> under the comment "Derive NN from disk"), so **once /wrapup deletes a group, a session resuming the same
> day restarts at `01`.** A stored boundary of `10` would then swallow the fresh `01`–`03` and delete them
> unread. A bare filename fails the same way — the reused name collides exactly. Only the content
> distinguishes a new checkpoint from a recovered one, so `sha256` is what the entry carries.

Recovered logs written by older /wrapup versions — those with no marker, those with a bare marker, and those carrying the interim `:through-NN` form — have **no `consumed:` list**, so they preserve nothing as far as /wrapup is concerned and their checkpoints are re-recovered into a duplicate session log. Acceptable and self-limiting: the duplicate carries a proper `consumed:` list, the group is then deleted, and it cannot recur. The asymmetry is deliberate — an omitted entry costs one duplicate log, whereas a wrong entry deletes history that exists nowhere else.

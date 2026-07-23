---
name: wrapup
description: "Wrap up and save the current session summary to the session log. Use at end of session when the user says 'bye', 'wrap up', 'save session', or an end-of-session signal is detected. /wrapup writes to 07-logs/ only. Do NOT use for: promoting insights to memory/ (use recap), synthesizing a topic across sessions (use distill), or teaching a single preference (use learn)."
schedulable: false
---

# Session Summary (TL;DR)

Generates a summary of this session and saves it to the logs folder for future recall.

---

## Scope

/wrapup writes the session log only. It does NOT promote insights to memory/ — that is
/recap's responsibility. Do not write to MEMORY.md or memory/ files.

---

## Session Log Frontmatter

See `skills/startup/references/session-formats.md` → Session Log Format for frontmatter variants and body sections. **Never add `recapped:` or `topics:`** — those are populated by /recap later.

---

## Step 0: Active Pause Thread Detection

Run this BEFORE Step 1.

1. Read `[logs_folder]/pause/_active.md`. If absent or empty → set `wrapup_mode = "session"`; skip to Step 1 (zero-overhead path for non-pause sessions).
2. If a slug is present: parse the file's single-line content as `slug`. Glob `[logs_folder]/pause/*-{slug}-pause-*.md` → `pause_count` (file count) and derive `first_date` = earliest `YYYY-MM-DD` date prefix among matched files (used in Step 3's question text).
3. Use `AskUserQuestion`:

   Question: "Active pause thread: `{slug}` ({pause_count} snapshots since {first_date}). Wrap up this thread now?"
   Options:
   - "Yes — consolidate into one session log" (sets `wrapup_mode = "thread"`)
   - "No — wrapup today's work only; keep pause thread active" (sets `wrapup_mode = "session"`)

4. If `wrapup_mode = "session"` AND active pause exists → fall through to **Step 0b: Auto-Finalize Pause** (below) BEFORE proceeding to Step 1.
5. If `wrapup_mode = "thread"` → proceed to Step 1 normally, then branch in Step 4 (see Step 4 modifications below).

---

## Step 0b: Auto-Finalize Pause (Session-mode wrapup with active thread)

Runs only when `wrapup_mode = "session"` AND `_active.md` exists.

Apply the three skip conditions from `skills/pause/SKILL.md` → Auto-Finalize section:

1. **No-activity:** if no checkpoint file exists for current `session_token`, skip Auto-Finalize.
2. **Already-captured-this-session:** if latest pause file's frontmatter `session_token` matches current AND no checkpoint mtime > pause file mtime, skip.
3. **No-pause-files-and-untouched:** if no pause file exists for slug AND newest checkpoint mtime < `_active.md` mtime, skip.

If not skipped: invoke `/pause` auto-finalize path (Steps 2–5 of `/pause`, with `trigger: auto-finalize` in frontmatter and "Auto-finalized at session end. " prefix in `## Where I Stopped`).

After Step 0b, continue to Step 1.

---

## Step 1: Gather Checkpoint Context

1. Get today's date as `YYYY-MM-DD`. Extract `YYYY` and `MM`.
2. Use `session_token` from context if already loaded (set by `onebrain session init` at startup).
   - **Codex:** SessionStart injects a token derived from the complete hook `session_id`. It is the chat identity for both Stop checkpoints and this wrapup. If that injected token is absent, stop and report that Codex hook context is missing; do **not** fall back to a terminal- or process-derived token because that could merge another chat's checkpoints.
   - **Claude/Gemini:** if absent, run `onebrain session init --json` and use the `SESSION_TOKEN` value.
3. Glob checkpoint files (post-v2.4.0: checkpoints live in flat `[logs_folder]/checkpoint/` regardless of date):
   - **Match on the token, with NO date filter:** `[logs_folder]/checkpoint/*-{session_token}-checkpoint-*.md`

   > **Why no date filter.** A date-bounded glob (today + yesterday) silently strands the checkpoints of a
   > session that has run three days or more: Step 1 does not see them because they are too old, and
   > Step 1b cannot see them because it **excludes the current token by design**. Neither path reads them
   > into a log and neither deletes them, so they sit in `checkpoint/` forever, invisible from both sides.
   > The directory is ephemeral and every file in it carries its owning token in the filename, so matching
   > on the token alone is both sufficient and complete — and the cross-midnight case then needs no special
   > handling at all.
4. If any found: **read every file** and extract its content. Every checkpoint must be fully incorporated during the review in Step 3 and reflected in the log written in Step 4 : not just used as background context. Checkpoints capture activity that may have been compressed out of current context; missing any of them means losing that history.
5. Store the list of found checkpoint paths for use in Step 5. **Only paths that were read and incorporated go on this list.**

If none found: continue normally.

> **Note on cleanup:** Checkpoints are deleted (not annotated) after the session log is successfully written. Any checkpoint file that still exists is unmerged by definition; no `merged:` filter is needed.

---

## Step 1b: Orphan Recovery Scan

After Step 1, scan for unmerged checkpoints belonging to **other** sessions (orphans).

**Variable scope (used throughout this step):** Initialize two lists at the top of Step 1b and keep them alive until Step 7 reads them at the end of /wrapup:
- `skipped_active = []` — `{path, age_minutes, reason}` records, where `reason` ∈ `{"active", "age_unknown", "concurrent_during_recovery", "delete_failed", "already_recovered", "marker_write_failed", "log_removed", "unread"}`. Both the *Active-Session Guard* and *Auto-Recover Each Orphan Group* append to this list. **When adding a new value to this enum, also add a corresponding row to the `{reason_summary}` rendering table in Step 7** (search this file for `{reason_summary}` rendering); unmapped values render via the catch-all fallback row but the user-facing string is generic, so an explicit row is required for new values.
- `orphaned_recovered_logs = []` — paths of recovered session logs left on disk by an aborted recovery. Two abort sources feed this list: (1) **concurrency abort** in step (g) when the owning session writes a new checkpoint mid-recovery and the recovered-log delete itself also fails; (2) **re-read failure** in step (f) — the recovery marker missing from the just-written log (LLM omission, partial write, encoding glitch), or a `consumed:` entry failing its re-hash — **where the log was successfully stripped of its bad entries rather than removed**. Both produce a recovered log left on disk without a deleted checkpoint group; the user must manually reconcile. When step (f) has to remove the log entirely, nothing is appended here (the path no longer exists) and the group is recorded `log_removed` instead. Listed in its own Step 7 block (these are not checkpoint files, so they don't fit the checkpoint-file heading).

### Scan Scope

Glob `[logs_folder]/checkpoint/*-checkpoint-*.md` (flat — post-v2.4.0 all checkpoints live in one directory regardless of date). No date filter: `checkpoint/` is ephemeral (cleaned by /wrapup after each session), so any file surfacing here is either an active cross-harness session (caught by the Active-Session Guard below) or a real orphan that needs recovery.

### Identify Orphans

From all found checkpoint files:
1. Parse session_token from each filename: the alphanumeric segment between the date and the literal word "checkpoint" in pattern `YYYY-MM-DD-{session_token}-checkpoint-NN.md`. If empty, apply Legacy token handling (see below) rather than skipping.
2. Exclude files where the parsed session_token exactly equals the current session token (those belong to the current session, already handled in Step 1). Do not use substring/contains matching — only exact equality.
3. Group remaining files by their parsed session_token. **Store the file list of each group as `group_files`** (the baseline used by step (g)'s concurrency re-glob below); never re-derive the group fresh later in this step.

**Legacy token handling:** If the parsed segment is a 6-character random string (pre-v1.10.4 format), still include the file in orphan recovery. Group these files under a synthetic key `legacy-{segment}` and process them the same way as regular groups. This ensures migration from v1.10.3 and earlier does not lose checkpoints. Note each legacy file in the Step 7 report as a warning.

If no orphan groups found: skip to Step 2.

### Active-Session Guard (Time Window)

> **Why this guard exists:** A non-current token does NOT mean the session is dead. When two harnesses (e.g. Claude + Gemini) run in the same vault, each sees the other's in-flight checkpoints as "non-current token". Without this guard, the first /wrapup to run would auto-recover the other harness's *active* checkpoints into a fake session log and delete the originals — silently corrupting the live session. Token != mine ≠ session is dead.

For each orphan group from the *Identify Orphans* step above, decide between **recover** and **skip-active** by file age (the `skipped_active` list was initialized at the top of Step 1b):

1. **Resolve the threshold once** (before scanning groups): read `onebrain.yml`'s `checkpoint.minutes` (defaults to 30 when the key is absent) and compute `threshold_minutes = max(60, 2 * checkpoint.minutes)`. Examples: default 30 → 60, raised 60 → 120, raised 90 → 180. If `onebrain.yml` is missing, malformed, or `checkpoint.minutes` is non-positive/non-numeric, fall back to `threshold_minutes = 60` — the recovery flow is critical-path; never block on a config issue.
2. Compute `now_epoch` once: `now_epoch=$(date +%s)`.
3. For every checkpoint file in the group, get its mtime as **epoch seconds**:
   - macOS / BSD: `stat -f '%m' <file>`
   - Linux / GNU: `stat -c '%Y' <file>`
   - Take the maximum across all files in the group as `group_newest_mtime`.
4. Compute `age_minutes = (now_epoch - group_newest_mtime) / 60` (integer division is fine).
5. **Fail-safe — destructive default is forbidden.** If any of the following is true, mark the group as **skip-active** (do NOT recover):
   - any stat call failed (file vanished mid-walk, EACCES, NFS error, etc.)
   - `group_newest_mtime` is empty / unparseable
   - `age_minutes` is negative (clock skew, future mtime)
   When ambiguity is detected, append every file path in the group to `skipped_active` as `{path, age_minutes: -1, reason: "age_unknown"}` and continue with the next group. Never fall through to recover when age cannot be determined.
6. **If `age_minutes < threshold_minutes`** — the group is still being written to recently. Treat it as **owned by another live session**:
   - For each file in the group, append `{path, age_minutes, reason: "active"}` to `skipped_active`.
   - Take **NO other action on these files anywhere in this skill** — not in Auto-Recover, not in Step 5 (Checkpoint Cleanup), not in any cleanup later.
   - Continue with the next group.
7. **If `age_minutes >= threshold_minutes`** — the group looks dead: fall through to **Auto-Recover Each Orphan Group** below for this group only.

The threshold gives the owning session a buffer of two full checkpoint windows (the auto-checkpoint hook fires every `checkpoint.messages` messages or `checkpoint.minutes` minutes). A group whose newest checkpoint is older than that has missed at least two windows — a strong "session dead" signal. The `max(60, 2 * checkpoint.minutes)` policy preserves the PR #156 baseline (60 min) for default-config users while scaling proportionally for users who raised `checkpoint.minutes`. **Be precise about which false-positive is safe — they are not symmetrical.** Judging a *dead* group *active* is harmless: nothing is read, written or deleted, and the owning user's next /wrapup consumes the still-on-disk checkpoints normally. Judging a *live but idle* group *dead* is **not** harmless — it falls through to Auto-Recover, which reads those checkpoints, writes them into a session log belonging to a different session, and **deletes them** (step g). No content is lost, but it is relocated: the owning session then wraps up and finds nothing, so its own log is missing the stretch that was taken. That is what `checkpoint.minutes` is really trading against — raise it if sessions in this vault routinely idle for long stretches.

> **Symmetry with `onebrain checkpoint orphans`:** the CLI applies the identical `max(60, 2 * checkpoint.minutes)` rule (in `onebrain-ai/onebrain-cli` → `crates/onebrain-fs/src/orphan/`, `is_group_active_or_ambiguous`) so the startup banner and the recovery skill agree on what is and isn't an orphan. If you change this policy in one place, change it in the other.

### Auto-Recover Each Orphan Group

**Progress signal**: if there are more than 3 orphan groups to recover, emit a one-line progress signal between groups so the user knows the skill is making progress: `Recovering orphan group {n}/{N} ({date})…`. Skip the signal when N ≤ 3 (recovery is fast enough that the signal would be noise).

For each orphan group (process in chronological order by date in filename):

**a. Already-recovered short-circuit.** Before reading checkpoint files, find every session log that already
recovered any part of this group. **Locate those logs by content, never by filename**: search
`[logs_folder]/session/` recursively for lines beginning `<!-- recovery-of: {token}:`, where `{token}` is the
orphan group's session token. A recovered log is named for the *earliest* date it covered (step d), so a
group spanning midnight — or a month boundary — files its later dates' markers inside a log whose name, and
whose `YYYY/MM` directory, belong to an earlier date. A filename glob cannot reach them; a content search
can.

> **Anchored match required:** match the marker **only when it appears at the start of a line** — either
> `\n<!-- recovery-of: {token}:` or the file beginning with `<!-- recovery-of: {token}:`. A bare substring
> match false-positives on session logs that quote the marker as documentation (this file's own examples,
> for one). Use `rg -n -F` with `--multiline` and a `(?m)^` anchor, or grep line-by-line. **Strip a trailing
> `\r` before the `startswith` check** — Windows-edited logs use CRLF endings, and without the strip a
> legitimate marker is silently missed. After the strip, check `line.startswith('<!-- recovery-of: ')`
> followed by a token check.

> **🔴 A marker NEVER authorises a delete. It proves only that A recovery happened for this `token:date`
> — never that THESE checkpoint files are preserved.** A session that keeps running after its checkpoints
> were recovered writes *more* checkpoints under the same token and the same date, and a marker-only check
> false-positives on every one of them. (Observed 2026-07-21: `2026-07-20-session-04.md` was written at
> 16:38 carrying the marker; the owning session then wrote checkpoints 04–07 at 16:40 / 17:15 / 19:08 /
> 22:36, none of whose content appears in that log. A marker-only short-circuit would have deleted an entire
> epic's history.) The marker's only job is to **find candidate logs cheaply**; every delete decision is
> made against the `consumed:` hashes below. This is also why a false-positive match is now merely wasteful
> rather than destructive: a documentation quote carries no `consumed:` list, so nothing matches and every
> checkpoint falls to `unpreserved`.

**What authorises a delete is the `consumed:` list, not the marker.** Every recovered log carries, in its
frontmatter, one entry per checkpoint whose content step (b) actually read and step (e) actually wrote into
that log:

```yaml
consumed:
  - file: YYYY-MM-DD-{token}-checkpoint-NN.md
    sha256: <first 16 hex characters of that file's SHA-256>
```

Step (e) writes it; this step reads it. The marker locates the log; the list is what proves preservation.

> **🔴 Why content hashes and NOT the checkpoint number.** `NN` is not stable, and the thing that
> destabilises it is *this step's own delete*. The CLI derives the next number by scanning the checkpoint
> directory — `max_checkpoint_nn` in `onebrain-cli`'s `crates/onebrain-cache/src/checkpoint.rs`, under the
> comment "Derive NN from disk"; `last_stop_nn` is written to the state file but never read back for
> numbering. So once step (g) empties a `{date}-{token}` group, a session that resumes **on the same day**
> starts again at `01`. A numeric boundary of `through-10` would then read the fresh `01`–`03` as
> `NN ≤ 10`, call them preserved, and delete them unread — the exact failure this step exists to prevent,
> re-entered through the renumbering the step itself causes. (Observed 2026-07-21 in this vault: token
> `4e57aeee` reached checkpoint `09`; /wrapup deleted the group, and the very next Stop hook reported
> `01 since start` — the CLI emits "since start" only when its directory scan finds nothing.) A filename is
> no safer: the reused name collides *exactly*. Only the content identifies the file.

> **Why not a timestamp either.** An earlier version of this rule compared each checkpoint's mtime against
> the recovered log's mtime. `/recap` edits session logs after the fact (it adds `recapped:`) and file sync
> rewrites mtimes on its own; either pushes the log's mtime *forward* and silently reclassifies
> un-recovered checkpoints as preserved. A content hash changes only when the content changes.

> **Normative hash definition — every producer and consumer of `sha256` MUST use exactly this.** Hash the
> **raw bytes of the file on disk**, whole and unmodified: not the extracted content, not the body with
> frontmatter stripped, not a normalised or re-encoded form. Take the **first 16 characters of the
> lowercase hex digest** (`shasum -a 256 <file>` / `sha256sum <file>`, then discard the trailing filename
> field the tool prints). A value of any other length, or in uppercase, is a malformed entry — treat it via
> the Fail-safe below rather than guessing. Hashing anything other than the raw bytes is not merely
> non-reproducible: a form that strips the frontmatter date, token, or `NN` can make two genuinely
> different files hash *equal* under a reused filename, which is the one combination that authorises a
> delete.

**Partition `group_files`. This is the ONE place that decides which bucket a checkpoint lands in, with a
single stated exception: the Fail-safe below, which on its own triggers re-buckets the whole group.** No
other rule in this skill adds, removes, or overrides a bucket assignment. Take each checkpoint still on
disk in turn, try to compute its hash as defined above, and assign it to exactly one of three buckets:

| Bucket | Condition | What happens to it |
|---|---|---|
| **`preserved`** | its hash was computed, and some recovered log's `consumed:` list holds an entry matching **both** `file` and `sha256` | its content is in that log · record `already_recovered` · **do not delete it here** — the sweep rule below decides which single site deletes it |
| **`excluded`** | its hash **could not be computed** (tool missing or blocked, I/O error, malformed digest) | record `{path, age_minutes, reason: "unread"}` · **never enters `recover_files`, never enters `consumed:`, is never deleted** |
| **`unpreserved`** | anything else — no matching entry, or a matching `file` with a **different** `sha256` (a number reused after a delete: a different file no log contains) | **never delete on the marker's strength** · these are what a new recovery log is for |

Then:

- **If `unpreserved` is non-empty**, set `recover_files = unpreserved` and fall through to step (b), leaving
  `preserved` and `excluded` out of the new log so the vault gains no duplicate content.
- **If `unpreserved` is empty**, there is nothing to recover: steps (b)–(h) will not run for this group.
  Step (a) sweeps `preserved` itself here (attempt each delete, recording `delete_failed` per file on
  failure), leaves `excluded` on disk, and continues with the next group.

> **Why `excluded` is its own bucket and not "unpreserved".** An un-hashable checkpoint can never gain a
> `consumed:` entry, so it can never become deletable; putting it in `unpreserved` sends it into a recovery
> that writes a log it can never be credited to, and the next run repeats that verbatim — one duplicate
> session log per group, per run, without bound. Excluding it terminates the loop: it is reported, kept, and
> retried only if something about it changes. The realistic trigger is not one odd file — if `shasum` /
> `sha256sum` is missing or blocked by a permission layer, hashing fails for **every** group in the vault at
> once.

**Logs with no `consumed:` list.** Every log written before this rule — including all those carrying only a
bare `<!-- recovery-of: {token}:{date} -->` marker, and any that carried the interim `:through-NN` form —
says nothing about *which files* it preserved. **Do not guess, do not fall back to mtime, and do not read a
`through-NN` as a boundary.** They contribute no entries, so their checkpoints land in `unpreserved` and are
recovered. The cost is one duplicated log, once — step (g) then deletes the group, so it cannot recur or
accumulate — bounded by the re-recovery writing a proper `consumed:` list, which is what lets step (g)
delete those files at all. (Step (g) sweeps only what `consumed:` proves preserved, so a file that can never
be read is never deleted; step (b)'s cut-off is what stops that case from producing a log every run.)
Duplication is an inconvenience; deletion is unrecoverable.

> ⚠️ **Set `recover_files`, do NOT overwrite `group_files`.** `group_files` stays the full group as
> captured in *Identify Orphans* step 3, because step (g)'s concurrency guard diffs a fresh re-glob
> against it: narrowing `group_files` would make the still-present `preserved` files look like paths that
> appeared mid-recovery and would abort every partial recovery with a false `concurrent_during_recovery`.
> Steps (b) and (e) read `recover_files`; step (g) uses `group_files` as the concurrency-diff baseline, and
> derives its delete set from the `consumed:` union (never from `group_files` itself). **`recover_files` is
> set in exactly two places: the partition above, and the Fail-safe below when it fires** — nowhere else,
> and the Fail-safe's assignment wins, because it fires precisely when the partition's inputs cannot be
> trusted. When no candidate log exists, every checkpoint that hashed simply lands in `unpreserved`, which
> is what `recover_files` becomes. Do not restate it as a default of `group_files`: that phrasing readmits
> `excluded`.
>
> **One deletion site whenever recovery proceeds.** Step (a) leaves `preserved` on disk in the
> fall-through case: two deletion sites for one group would make step (g) sweep files (a) had already
> removed, turning each into a spurious `delete_failed` whose recorded remedy — "the next /wrapup will clean
> it up" — names a file that no longer exists. Deferring costs nothing (the same files are deleted moments
> later by (g), after (f) has confirmed the new log) and buys atomicity: if recovery of `unpreserved`
> aborts, `preserved` is still on disk and the group can be retried whole.
>
> **Exactly one site sweeps `preserved` for a given group. There are exactly three sweeping sites, and this
> is the complete list — there is no general test to derive it from:**
>
> - **step (g)**, the normal path;
> - **step (a)'s `unpreserved`-is-empty branch** — nothing to recover, so (b)–(h) never run;
> - **step (b)'s read cut-off** — nothing could be read, so (c)–(h) never run.
>
> **Every other exit must NOT sweep.** Specifically step (f)'s abort and step (g)'s concurrency abort: they
> hand the group to the next run *intact*, which re-partitions, re-recovers `unpreserved`, and lets (g)
> sweep normally. Sweeping there would destroy the property stated just above — that an aborted recovery
> leaves `preserved` on disk and the group can be retried whole — and step (g)'s concurrency abort is the
> worst possible moment to delete anything, since it fires precisely when the guard has proved the owning
> session is alive.
>
> Earlier drafts tried to derive this list from a one-line test ("whichever step exits owns it", "is the
> exit a fixed point", "does (g) run in this run"). Every such test misclassified at least one of the four
> exits, because "ends the group for good" and "does not reach (g)" are different properties and the aborts
> satisfy only the second. **Do not reintroduce a derived test — add to or remove from the list above, and
> say why.**
>
> The two sweeping exits delete without a pre-delete re-stat and without (g)'s token-only re-glob. Acceptable
> *only* there, because every file they touch is proved by a `consumed:` entry to be in a prior log, so
> neither a stale age check nor an unseen concurrent write can cost content — the guarantee comes from
> `consumed:`, not from the timing check. One consequence to accept knowingly: `concurrent_during_recovery`
> can never be reported on those two paths. Never extend the exemption to another site, nor to a file that
> is not `preserved`.

**Fail-safe.** A checkpoint whose hash cannot be computed is handled by the `excluded` bucket above and by
nothing else — do not re-decide it here. For every *other* ambiguity — a `consumed:` list that cannot be
parsed, an entry missing `file` or `sha256`, or any comparison you cannot resolve — treat the **whole group
as `unpreserved`**: delete nothing, set **`recover_files = group_files` minus `excluded`**, and fall through
to step (b). **This assignment overrides the partition's** — it is the one exception named there, and it
wins because the Fail-safe fires exactly when the evidence the partition relied on is untrustworthy. The
subtraction of `excluded` is not optional: `group_files` contains the un-hashable files, and they can never
be credited in `consumed:` no matter which log is written.

> **Discard any `preserved` the partition had already assigned, and its `already_recovered` records with
> it.** `preserved` is NOT empty by construction here: the Fail-safe's triggers — an unparseable list, an
> entry missing a key — are discovered *while* walking candidate logs, so an earlier valid log may already
> have proved some files. Those proofs came from the same scan that turned out to be unreliable, so they
> must not survive it: re-recover those files instead. They gain a fresh `consumed:` entry in the new log
> and step (g) deletes them correctly. Keeping them `preserved` would let a malformed list authorise a
> delete, which is the one thing this whole path exists to prevent. Duplicated content is an
inconvenience; a deleted checkpoint is unrecoverable, so ambiguity must always resolve toward keeping the
file.

> **Why marker, not frontmatter:** the marker names the specific `token:date` pair recovered, which frontmatter doesn't. A multi-group recovery log can therefore short-circuit per group rather than as a whole, and the marker is harness-/version-independent (frontmatter keys have drifted across releases). See `skills/startup/references/session-formats.md` → *Recovered from checkpoints* for the canonical marker spec.

**b. Read all checkpoint files** in **`recover_files`**, as set by step (a) — do not re-derive it here.
Extract content from each.

> **Cut-off — if nothing could be read, write no log.** Trigger: **no read in `recover_files` succeeded** —
> which includes the case where `recover_files` is **empty**, so there was nothing to read at all. (State it
> that way, not as "every read failed": over an empty set that phrasing is a vacuous-truth judgement an
> executor can resolve either way, and resolving it *false* falls through to (c)–(h), which then writes a
> contentless log with zero markers and an empty `consumed:` list — and step (f) passes it, because zero
> markers over zero dates is vacuously satisfied and an empty list is explicitly not a failure.)
>
> There is nothing to put in a log, so **skip steps (c)–(h) and continue with the next group**, exactly as
> step (a)'s `unpreserved`-is-empty branch does. Do the sweep described below *inside this step* before
> moving on — (g) must not run, or it would rebuild `deletable` from a `consumed:` list step (e) never wrote
> and try to delete the same `preserved` files a second time, turning each into a spurious `delete_failed`
> whose remedy names a file this run already removed; and (h) must not run, or the report claims a recovered
> session for a log that was never written. Append `{path, age_minutes, reason: "unread"}` for each
> file **in `recover_files`** — never for `group_files`, because a `preserved` file was not read here for
> the good reason that it was never meant to be, and tagging it `unread` would outrank its truthful
> `already_recovered` record in the Step 7 precedence.
>
> **Still sweep `preserved` before moving on.** Delete the `preserved` files exactly as the
> `unpreserved`-is-empty branch of step (a) does, recording `delete_failed` per file on failure. Their
> content is in a prior log, and step (g) — the site that would normally sweep them — is not going to run.
> Skipping the sweep as well would strand them permanently: every later /wrapup would re-partition the same
> group, re-report the same files, and resolve nothing.
>
> Without this cut-off, an unreadable checkpoint (a permanently unsynced cloud placeholder is the realistic
> case) makes every /wrapup write a fresh session log containing no content, forever — the group can never
> empty, because step (g) deletes only what `consumed:` proves preserved. One junk log per run, accumulating
> without bound. The unreadable files themselves are not lost, only retried, and the repeated `unread` line
> is the signal that a human needs to look.

**c. Determine the session date** from the filename (`YYYY-MM-DD` prefix of the files in `recover_files`). If they have different date prefixes (cross-midnight session), use the earliest date.

> **A repeat marker for the same `token:date` is expected, not a defect.** When step (a) narrowed the
> group, the log written in step (e) carries the same `<!-- recovery-of: {token}:{date} -->` marker as the
> earlier one. That is correct: the two logs hold disjoint `consumed:` entries and step (a) reads the union
> of every matching log's list. Do not "deduplicate" these markers, and never merge or prune the lists.

**d. Determine the session file name** for that date:
   - List files in `[logs_folder]/session/YYYY/MM/` matching `YYYY-MM-DD-session-*.md` (using the orphan date's YYYY/MM)
   - Next session number = count of matches + 1 (zero-padded to 2 digits)
   - Verify the slot is free; increment NN until free

**e. Write the recovered session log** at `[logs_folder]/session/YYYY/MM/YYYY-MM-DD-session-NN.md`. Create the directory `[logs_folder]/session/YYYY/MM/` (using the orphan date's YYYY/MM) if it does not already exist. Use the Session Log Format from `skills/startup/references/session-formats.md` (case: **Recovered from checkpoints**). Two things are required and load-bearing:

1. **The body marker** `<!-- recovery-of: {token}:{date} -->` as the first body line, before the `# Session Summary` heading — one line per distinct date present in `recover_files`, on consecutive lines. It is the locator step (a) greps for.
2. **The `consumed:` frontmatter list** — one `{file, sha256}` entry for **every checkpoint whose content this log actually contains**, and for no other. Compute `sha256` by the **normative hash definition in step (a)**: the raw bytes of the checkpoint file on disk, first 16 characters of the lowercase hex digest. Never hash the extracted content — step (a) hashes the file, and the two must agree.

> **🔴 Write `consumed:` from what you READ, never from what you FOUND.** If a read in step (b) failed for
> any reason — permissions, an unsynced cloud placeholder, a decode error, or simply dropping one file from
> a long batch — that checkpoint must NOT get an entry, no matter that it sits in `recover_files`. An entry
> is a promise that this log holds that file's content; a false promise makes step (a) delete the file on
> the next run, and no fail-safe can catch it because the entry parses perfectly. When in doubt, omit the
> entry: the cost is re-recovering one checkpoint, versus destroying it.

Apply the **Preservation rule** from Step 4 below: deduplication only, no summarization. Every unique decision, action item, open question, learning, and topic from every checkpoint **in `recover_files`** must appear in the recovered session log — except a checkpoint that could not be read, which appears in neither the body nor `consumed:`, and is therefore left on disk for the next run to retry. Name any such file in the log body so the omission is visible rather than silent.

> **If step (a) narrowed the group, say so in the log body.** Add a short blockquote under the heading
> naming the earlier recovered log and which checkpoint files this one covers.
> A reader who later finds two logs for one `token:date` needs to know they are consecutive slices rather
> than duplicates — and the note is also the evidence that the narrowing was deliberate.

**f. Verify the session log** exists and is non-empty before continuing. **Re-read check (required):** re-read the file from disk and confirm both:

- an anchored `<!-- recovery-of: {token}:{date} -->` line exists for **every** distinct date in `recover_files`, before the `# Session Summary :` heading; and
- the `consumed:` list parses, **every entry's `sha256` still matches a re-hash of the named file on disk**, and the list holds **at least one entry**. A *shorter* list than `recover_files` is legitimate — an entry may rightly have been omitted for a file whose read failed. An **absent or empty** one is not: step (b)'s cut-off guarantees this step is only reached when at least one read succeeded, so a log with no entries contradicts its own precondition, and it is the same executor-omission-on-write failure the marker arm of this check exists to catch. Treat it as a failure.

> **Why an empty list must fail rather than pass quietly.** It passes both arms otherwise — markers are
> present, and "no entries" trivially satisfies "every entry re-hashes". Step (g) then finds `deletable`
> empty, deletes nothing, and reports every file `unread`; the next run sees the new log contribute no
> entries, re-recovers the same group, and writes another log. One junk session log per run, forever, with
> no error surfaced — the loop class the `excluded` bucket was introduced to terminate, arriving through the
> commonest configuration of all (no prior log).

Re-hashing catches a **copied or stale** entry — one naming a file whose content has since changed, or lifted from another log. An entry naming a file that is *absent* from disk is fine (another run may have swept it); an entry whose file is present with a *different* hash is not.

> **What re-hashing does NOT prove, stated plainly.** It verifies entry against disk, never log-body against
> entry. An entry for a file that really is on disk and really does hash correctly passes this check even if
> its content was never written into the log body — and it then authorises step (g) to delete that file. No
> mechanical check in this skill closes that gap; the only thing standing in it is step (e)'s rule to write
> `consumed:` from what was actually read. Treat that rule as load-bearing, not advisory: when unsure
> whether a checkpoint's content really reached the body, omit the entry.

If either check fails, **abort recovery for this group**: do NOT proceed to step (g) (no delete) **and do NOT run step (h)** (no `recovered_sessions` entry — this recovery did not happen, and claiming it would put a line in the report for a log that was stripped or removed). For each file in **`recover_files`** append `{path, age_minutes, reason: "marker_write_failed"}` to `skipped_active` — and for no other file. A `preserved` or `excluded` file was never read this run, never written into the failed log, and had nothing to do with it; tagging it here outranks its truthful record and sends the user to the resolution subsection below to repair a log that has nothing to do with that file (and, for an `excluded` file, to run the very hash that cannot run on it).

> **Neutralise the bad log before returning — and report only what you left behind.** Aborting alone is not
> enough: the log stays on disk, step (a) reads the union of every matching log's list, and a wrong entry
> would be trusted forever by runs that never saw this failure — including unattended `onebrain skill run`
> invocations with nobody to read Step 7. **An abort must never leave behind a claim it just proved false.**
>
> - **Strip the `consumed:` list** to only the entries that re-hashed correctly (dropping the list entirely
>   if none did), then **append the log path to `orphaned_recovered_logs`** so Step 7 points the user at a
>   file that genuinely exists and can be repaired in place.
> - **Only if the log cannot be rewritten at all** (a write error — not merely an awkward edit), delete it.
>   Then do **NOT** append it to `orphaned_recovered_logs`, and record the group's files with
>   `reason: "log_removed"` instead of `marker_write_failed`. Reporting a path this run destroyed sends the
>   user hunting a file that is gone — the same defect this release fixed for `already_recovered` records —
>   and `marker_write_failed`'s summary string and resolution subsection both assert a log that still
>   exists, so reusing it here would state the opposite of what happened.
>
> No content is lost either way: the checkpoints were not deleted, so the next run recovers them afresh.

**g. Delete checkpoint files** for this group after confirming step f succeeded.

   - **Pre-delete re-stat (concurrency guard) — runs ONCE before any deletes:** re-stat every file in `group_files` (stored in *Identify Orphans* step 3) AND re-glob **`*-{token}-checkpoint-*.md`** under `[logs_folder]/checkpoint/` (flat) — token-only, **no date component**, matching how *Identify Orphans* keys the group. A date-bounded pattern would be blind to the single most likely proof that the owning session is alive: it waking up and writing a checkpoint under **tomorrow's** date. The mtime arm cannot cover that either — an existing file's mtime does not change when a *new* file appears — so a date-scoped re-glob leaves the guard unable to fire at all in that case, and step (g) deletes a live session's history. The owning session became active during recovery if **either** of these holds:
       - any file's mtime has changed since the Active-Session Guard's stat above, OR
       - the re-glob result contains a path NOT present in `group_files` (set difference: `re_glob_files \ group_files` is non-empty).
   - **If concurrent activity is detected:** **abort the delete entirely for this group.** Then attempt to delete the recovered session log written in step (e) so it does not leak duplicate content into the vault. For each file in **`recover_files`**, append `{path, age_minutes, reason: "concurrent_during_recovery"}` to `skipped_active` (use the original `age_minutes` from the Active-Session Guard) — and for no other file, for the same reason as step (f)'s abort: `preserved` and `excluded` files took no part in this recovery and keep their own records. If the recovered-log delete itself fails, append the recovered-log path to `orphaned_recovered_logs` (a separate list initialized at the top of Step 1b) so the user sees it under its own Step 7 block — these are session-log files, not checkpoint files, and conflate poorly with the checkpoint-file heading. Continue with the next group.
   - **If no concurrent activity:** build the delete set — **`deletable` = every file in `group_files` that some `consumed:` entry proves preserved**, taking the union of the prior logs' lists read in step (a) AND the list step (e) just wrote, matching on filename plus hash as in step (a). **Delete `deletable`, never `group_files`.**

     > **🔴 `group_files` is the concurrency baseline, NOT the delete set.** Step (e) may legitimately omit a
     > file from `consumed:` — a checkpoint whose read failed (an unsynced cloud placeholder is the ordinary
     > case, not an exotic one) is absent from both the log body and the list. Deleting `group_files` would
     > destroy that file with its content in no log: the very failure this step exists to prevent, arriving
     > through the one path step (f) does not check, since (f) verifies entries against disk and never disk
     > against entries. The `consumed:` list is the reconciliation between what was read and what may be
     > deleted — using it here is the whole point of writing it.

     **Per-file failure rule:** if an individual `rm` fails (EACCES, NFS hiccup, etc.), do NOT abort the whole group — append `{path, age_minutes, reason: "delete_failed"}` to `skipped_active` (reuse the original `age_minutes` from the Active-Session Guard, never `0`) and continue with the next file. The recovered session log is already written; the next /wrapup's short-circuit (step a) will match its hash and clean it up.

     **Files in `group_files` but not in `deletable`** — still inside this no-concurrency branch, because `deletable` is built here and exists nowhere else — were not proved preserved, so they stay on disk and the next /wrapup retries them. Append `{path, age_minutes, reason: "unread"}` to `skipped_active` for each, so the omission reaches the user instead of looking like a successful sweep. The reason names what the run can actually establish — *not proved preserved* — which covers a failed read, a hash that could not be computed, and an entry step (e) omitted for any other reason. If the same path is reported on repeated runs it needs manual attention; the Step 7 line is the only place that surfaces it.
   - **Stage discipline (do not conflate the two rules above):** the concurrency check runs ONCE at the top of step (g). After it passes, individual `rm` failures are NEVER interpreted as concurrency — they record `delete_failed` per-file and the loop continues. Do not re-run the concurrency check between per-file deletes; do not promote a per-file `delete_failed` to `concurrent_during_recovery`. The only group-level abort path is the pre-delete concurrency check.
   - Guard: only delete AFTER step f is confirmed AND the re-stat shows no concurrent activity. Never delete before.

**h. Track recovered sessions:** append `{date} → session-NN.md ({C} checkpoints)` to a `recovered_sessions` list for the final report, where `{C}` is `len(consumed:)` for the log just written — the files this log actually preserved, which after a step (a) narrowing is smaller than the group.

---

## Step 2: Determine Session File Name

1. Using the date from Step 1, extract `YYYY`, `MM` (zero-padded month), and `DD` (zero-padded day).
2. List files in `[logs_folder]/session/YYYY/MM/` matching **`YYYY-MM-DD-session-*.md`** — use today's actual date as a literal prefix (e.g. `2026-04-25-session-*.md`), not as a wildcard. Only count sessions from today.
3. The next session number = count of matches + 1 (zero-padded to 2 digits: 01, 02, etc.)
4. Verify `YYYY-MM-DD-session-NN.md` does not already exist before writing; if it does, increment NN until a free slot is found.
5. File name: `[logs_folder]/session/YYYY/MM/YYYY-MM-DD-session-NN.md`

---

## Step 3: Review the Session

Reflect on the conversation that just occurred. Identify:

- **Main topic(s)** : What did we work on?
- **Key decisions made** : Any choices, directions, or conclusions reached
- **Insights or learnings** : New understanding, patterns noticed, things discovered
- **What worked / didn't work** : Approaches or tools that helped, and anything that slowed us down or failed (omit if nothing notable)
- **Action items** : Tasks to do, things to follow up on
- **Open questions** : Unresolved questions or things to investigate

---

## Step 4: Write the Session Log

**Branch on wrapup_mode (set in Step 0):**

- If `wrapup_mode = "session"` → follow the existing flow below (no changes).
- If `wrapup_mode = "thread"` → use the **Thread Wrapup Branch** below instead of the existing flow:

### Thread Wrapup Branch

1. Glob `[logs_folder]/pause/*-{slug}-pause-*.md` → read every file in chronological order (date prefix ascending, then NN ascending). Store as `pause_files`. Also derive `first_date` = date prefix of `pause_files[0]` and `last_date` = date prefix of `pause_files[-1]` (used in Step 7 confirm).
2. Combine `pause_files` content + checkpoint content from Step 1 (today's session). Apply the Preservation rule (deduplication only, no summarization) across all of them.
3. Determine session file name per existing Step 2 logic.
4. Write `[logs_folder]/session/YYYY/MM/YYYY-MM-DD-session-NN.md` using the **Thread wrapup — pause snapshots incorporated** frontmatter case from `skills/startup/references/session-formats.md`:
   ```yaml
   ---
   tags: [session-log]
   date: YYYY-MM-DD
   session_token: <token>
   session: NN
   synthesized_from_pause: true
   pause_slug: <slug>
   ---
   ```
5. Body: merged content from step 2, using the Shared Body Sections.
6. After successful write, run `onebrain checkpoint reset`.
7. Proceed to Step 4b (action item routing) and onward as normal.

After Thread Wrapup writes the session log, the existing Step 5 (Checkpoint Cleanup) still runs — checkpoints from Step 1 are deleted. **Plus, in the new Step 5b (below), pause files and `_active.md` are deleted.**

---

> **Preservation rule (critical when checkpoints exist):** the session log must preserve **every unique detail** from every checkpoint file read in Step 1. Your job is **deduplication, not summarization**. Two pieces of content are duplicates only if they describe the same fact, decision, learning, action item, or question. When in doubt, keep both — the session log is the long-term archive of the session, and missing a unique decision or insight cannot be recovered later.
>
> Specifically:
> - **Key Decisions, Action Items, Open Questions** — list every unique entry as its own bullet. Do not collapse multiple decisions into a single line. Do not paraphrase away specificity (file paths, numbers, named constraints).
> - **What We Worked On** — every distinct topic from any checkpoint must appear. Order chronologically. Two checkpoints touching the same topic can be merged into one paragraph; two checkpoints on different topics must remain two paragraphs.
> - **Insights & Learnings, What Worked / Didn't Work** — preserve all unique items. If a learning appears verbatim in two checkpoints, list it once. If two checkpoints have *related but distinct* learnings (e.g., "X works on macOS" + "X breaks on Windows"), keep both.
> - **No length cap** — the session log can be long if the session was substantive. Do not truncate or omit content to hit a perceived target length.
>
> Quality heuristic: the session log's combined length of Key Decisions + Action Items + Open Questions should be at least as long as the sum of those sections across all checkpoints. If your draft is shorter, you've lost detail — go back and add the missing items.

Create `[logs_folder]/session/YYYY/MM/YYYY-MM-DD-session-NN.md` using the Session Log Format from `skills/startup/references/session-formats.md`:
- If checkpoints were incorporated in Step 1 → use **Standard /wrapup — checkpoints incorporated**
- Otherwise → use **Standard /wrapup — no checkpoints incorporated**

After writing the session log, reset the checkpoint hook counter to prevent spurious post-wrapup checkpoints:

```bash
onebrain checkpoint reset
```

This writes `0:<epoch>:00` into the session state file (3 fields: count, last_ts, last_stop_nn) — triggering a 60-second skip window and resetting the message counter so the next Stop hook starts fresh.

---

## Step 4b: Route Action Items to Project Notes

After the session log is written, automatically move action items to the appropriate project note so the startup task scan picks them up.

Store `routed_tasks = []` and `skipped_tasks = []` for use in Step 7.

**4b-1. Extract tasks.** Parse the `## Action Items` section of the session log just written. Collect all lines matching `- [ ] ...`. If none, skip this step entirely.

**4b-2. Discover project notes.** Glob `[projects_folder]/**/*.md`. For each file, collect the folder name (first path segment under `[projects_folder]`) and the filename stem as candidate keywords.

**4b-3. Score and group tasks by target.**

Store `skipped_score0 = []` and `skipped_ties = []` alongside `skipped_tasks` for internal tracking.

For each task line:
  - Score each candidate project note: split the folder name and filename stem on hyphens and underscores to produce individual keyword tokens, then count how many tokens appear as case-insensitive whole-word matches in the task text.
  - Select the highest-scoring candidate. **Require score ≥ 1 and a unique winner (no tie at the top score)** to route.
  - If score = 0 → add to `skipped_score0` and `skipped_tasks`; leave task in session log only.
  - If two or more files tie at the top score → add to `skipped_ties` and `skipped_tasks`; leave task in session log only.
  - Otherwise → assign the task to the winning project note.

**4b-3b. Session-context fallback for score-0 tasks.**

If `skipped_score0` is non-empty, resolve a session context project:
  - Parse the `## What We Worked On` section of the session log.
  - Tokenize the section text (split on spaces, hyphens, underscores, commas).
  - Score each project note candidate using the same token-match algorithm as 4b-3.
  - If a unique winner exists (score ≥ 1, no tie) → that is the `context_project`.
  - For each task in `skipped_score0`: remove it from `skipped_tasks` and assign it to `context_project`.
  - If `## What We Worked On` is absent or produces no unique `context_project` → these tasks stay in `skipped_tasks`.
  - Tasks in `skipped_ties` are never candidates for the fallback — they remain in `skipped_tasks`.

Group all assigned tasks by their target file path. This avoids repeated reads and writes to the same note.

**4b-4. Write each target file once.**

For each target file with one or more assigned tasks:
  - Read the file once.
  - For each task assigned to this file:
    - **Dedup check:** strip the trailing `📅 YYYY-MM-DD` suffix from both the candidate task and all existing task lines (lines matching `- [ ]` or `- [x]`) before comparing. If a task with the same text (open or completed) already exists in the file, skip this task; add to `skipped_tasks`.
    - **Insertion point (priority order):**
      1. Find an existing `## Action Items` section — append after the last `- [ ]` line in it, or after the heading if the section is empty.
      2. If no `## Action Items` section: insert one before `## Open Questions` if present, otherwise before `## Related`, otherwise at the end of the file. Add a blank line before and after the new heading.
    - Collect all non-skipped tasks for this file.
  - If no non-skipped tasks remain after dedup, skip the write entirely for this file.
  - Otherwise write the updated file once. On write error, move all non-deduped tasks for this file to `skipped_tasks` and continue.
  - Store the vault-relative path (e.g. `01-projects/onebrain/OneBrain.md`) as `relative_path`. Append each successfully inserted task as `{task_text, relative_path}` to `routed_tasks`.

**4b-5. This step must never fail /wrapup.** All errors (read/write failures, no project notes found) are silently handled per task or per file. The session log is always the source of truth.

---

## Step 5: Checkpoint Cleanup

After the session log from Step 4 is written successfully, delete every checkpoint file path stored in Step 1.

Guard: only delete AFTER confirming the session log write succeeded. Never delete before or during write. If an individual delete fails, skip it silently — stale checkpoints are cleaned up later by /doctor or by the next /wrapup.

> **Why direct delete (no `merged:` annotation):** A successfully written session log is itself the proof that the checkpoint content is preserved. Annotating the checkpoint with `merged: true` and then deleting it adds a write step that can fail and provides no recovery benefit — if the session log write succeeds, the checkpoint is safe to delete; if it fails, we never reach this step.

---

## Step 5b: Pause Cleanup (Thread Wrapup only)

Runs only when `wrapup_mode = "thread"`.

After the session log from Step 4 (Thread Wrapup Branch) is written successfully:

1. Delete every file in `pause_files` from Step 4 Thread Wrapup Branch step 1.
2. Delete `[logs_folder]/pause/_active.md`.

Guard: only delete AFTER confirming the session log write succeeded. If an individual delete fails, skip silently — `/doctor` will catch stragglers.

---

## Step 6: Recap Reminder

At the end of every /wrapup, compute `unrecapped_count` and `last_recapped`:

**Fast path:** read `stats.last_recap` from `onebrain.yml` if available.
**Glob session logs only:** match the `*-session-*.md` file pattern under
`[logs_folder]/session/` (post-v2.4.0: session logs live in their own
subfolder). Use `[logs_folder]/session/YYYY/MM/*-session-*.md` over the
last 6 months and check the `recapped:` field on each. The `-session-`
infix filter is no longer strictly required since `session/` only contains
session logs, but keep it as a defense-in-depth for any non-session
artifact a future version might place there.

Compute:
- `unrecapped_count` — number of session logs without `recapped:` field
  (always ≥ 1 after /wrapup runs — the log just written has no `recapped:` yet)
- `last_recapped` — most recent `recapped:` date found (absent = never)

Display based on condition:
- unrecapped 1–3, last recap ≤ 7 days ago:
    💾 {N} session logs not yet recapped (last: YYYY-MM-DD)
- unrecapped > 3 OR last recap > 7 days ago:
    ⚠️ {N} session logs not yet recapped — last recap: YYYY-MM-DD
- never recapped:
    ⚠️ {N} session logs not yet recapped — never recapped

---

## Step 7: Confirm

Say:
──────────────────────────────────────────────────────────────
💾 Session Saved
──────────────────────────────────────────────────────────────
`[logs_folder]/session/YYYY/MM/YYYY-MM-DD-session-NN.md`

I logged {N} action items.
(omit this line if no action items)

Routed {R} action item(s) to project notes:
  → [task text] → `01-projects/…/Note.md`
(omit this block if routed_tasks is empty; list one line per routed task, using the vault-relative path stored in routed_tasks)

Skipped routing (no match / tie):
  · [task text]
(omit this block if skipped_tasks is empty; list one line per skipped task)

**If `wrapup_mode = "thread"`:** replace the standard header with:

```
──────────────────────────────────────────────────────────────
💾 Thread Wrapped Up — `{slug}`
──────────────────────────────────────────────────────────────
`[logs_folder]/session/YYYY/MM/YYYY-MM-DD-session-NN.md`

Consolidated {P} pause snapshots from {first_date} to {last_date} + {C} checkpoint(s) from today.
```

Where `{P}` is `len(pause_files)`, `{C}` is the checkpoint count from Step 1. Then continue with action-item routing summary, orphan recovery summary, recap reminder as normal.

**If `wrapup_mode = "session"` AND Step 0b Auto-Finalize ran (not skipped):** add a line after `💾 Session Saved`:

```
📂 Auto-finalized pause thread `{slug}` (snapshot {NN}). Thread still active — /resume to continue.
```

**If `wrapup_mode = "session"` AND Step 0b Auto-Finalize was skipped due to skip-condition (1, 2, or 3):** add a line after `💾 Session Saved`:

```
📂 Pause thread `{slug}` still active ({pause_count} snapshots) — /resume to continue.
```

Auto-recovered {S} orphan session(s):
  {YYYY-MM-DD} → `session-NN.md` ({C} checkpoints)
(omit this block if none recovered)

Skipped {A} checkpoint file(s) ({reason_summary}):
  · `YYYY-MM-DD-{token}-checkpoint-NN.md` (age: {age_minutes}m, reason: {reason})
(**Required output — do NOT omit when skipped_active is non-empty.** This block is the user's only signal about checkpoint files this run did not recover into a log of its own. **Drop every `already_recovered` record whose file THIS RUN deleted, at whichever site deleted it.** The deletion sites are step (a)'s `unpreserved`-is-empty branch, step (b)'s read cut-off, and step (g) — but do not lean on that list: the test is the on-disk state at render time, so it stays correct even if a site is added or moved. (If you do add one, add it here too.) Those files are neither left on disk nor unaccounted for, and listing them sends a user investigating a suspected data loss to look for files this run destroyed on purpose. The test is "is it still on disk when the report renders", never "which step ran" — step (a)'s branch is the ordinary path for any group a prior log already covers, so scoping the test to step (g) mis-reports the commonest case of all. Keep an `already_recovered` record only when the file genuinely survived this run (its delete failed, or the group aborted before any delete).

**Then collapse to one record per path.** A single file routinely collects several records — a `preserved` file gets `already_recovered` in step (a) and then `marker_write_failed` or `concurrent_during_recovery` if the group later aborts, or `delete_failed` if its `rm` fails. Keep the **most specific** one and drop the rest, by this precedence (highest wins): `delete_failed` › `concurrent_during_recovery` › `marker_write_failed` › `log_removed` › `unread` › `already_recovered` › `age_unknown` › `active`. Without this, one file is listed several times, `{A}` overstates what is on disk, and `{reason_summary}` renders a spurious `mixed:` for what is a single file in a single state. `{A}` is the count after the drops and the collapse. List one line per `{path, age_minutes, reason}` record. Render `age_minutes` as a non-negative integer; if `-1` (sentinel), render as `age: unknown`. Render `reason` verbatim from the record. If `{A}` > 5, list the first 5 and add a final line `· (+{A-5} more)`. Omit this block ONLY when `skipped_active` is empty.

**`{reason_summary}` rendering — use the table below VERBATIM, do not paraphrase. Enum values are defined at the top of Step 1b alongside `skipped_active`; if you add a new value there, add its row here too:**
  - all records have `reason: "active"` → `another harness still running`
  - all records have `reason: "age_unknown"` → `age could not be determined`
  - all records have `reason: "concurrent_during_recovery"` → `owning session became active mid-recovery`
  - all records have `reason: "delete_failed"` → `checkpoint delete failed`
  - all records have `reason: "already_recovered"` → `already preserved in a prior recovered log`
  - all records have `reason: "marker_write_failed"` → `recovered log saved but recovery-of marker missing — see "Resolving marker_write_failed" below`
  - all records have `reason: "log_removed"` → `recovered log could not be written correctly and was removed — checkpoints kept, next /wrapup retries`
  - all records have `reason: "unread"` → `not proved preserved — kept on disk` (do not promise a retry: a file excluded for an uncomputable hash is retried only if that changes)
  - multiple distinct reasons → `mixed: ` + comma-joined sorted unique reason values (e.g. `mixed: active, delete_failed`)
  - **fallback (catch-all):** all records share a single `reason` value not listed above → `skipped (reason: {reason})` — render the raw enum value verbatim. This row exists to prevent silent rendering drift when a new `reason` value is added to the enum without a matching table entry; the surface signal is generic on purpose so a missing row is visible to the user (and prompts a contributor to add the proper mapping above).

Orphaned recovered log(s) needing manual cleanup ({L}):
  · `session/YYYY/MM/YYYY-MM-DD-session-NN.md`
(**Required output — do NOT omit when orphaned_recovered_logs is non-empty.** These are session-log files written by an aborted recovery — either (a) the owning session became active mid-recovery and the cleanup delete of the recovered log itself also failed (`concurrent_during_recovery`), or (b) step (f)'s re-read found the `<!-- recovery-of: ... -->` marker missing or a `consumed:` entry failing its re-hash, and the log was stripped rather than removed (`marker_write_failed`). In both cases the file persisted but its checkpoint group was NOT deleted. A log that step (f) had to remove outright never appears here — its group carries `log_removed` in the block above. Cross-reference with the `Skipped {A} checkpoint file(s)` block above to identify which group each entry belongs to and the actionable fix per `reason`. `{L}` is `len(orphaned_recovered_logs)`. List one line per path. Omit this block ONLY when `orphaned_recovered_logs` is empty.)

{Recap reminder message from Step 6}

Good session! See you next time.

### Resolving `marker_write_failed`

Render this subsection in the Step 7 report **only when `orphaned_recovered_logs` is non-empty AND the report contains a `marker_write_failed` record** — both, because every remedy below operates on a log file that still exists. Never render it for a `log_removed` group: there is no path to open, and both remedies would be impossible. The text is a numbered list (more robust against LLM paraphrase pressure than long single-liners) and disambiguates token sourcing — date is in the recovered-log filename, token is in the still-present checkpoint filenames in the `Skipped {A} checkpoint file(s)` block.

> A `marker_write_failed` record means a recovered session log exists on disk but is missing a `<!-- recovery-of: {token}:{date} -->` marker line, or its `consumed:` list is unparseable or failed the re-hash check. The checkpoints were NOT deleted. Without intervention, every subsequent /wrapup re-recovers them and grows this list. Pick **one** — both are correct and final:
>
> 1. **Repair in place.** Open the recovered log path listed in `Orphaned recovered log(s) needing manual cleanup`. Add `<!-- recovery-of: {token}:{date} -->` as the first body line, before the `# Session Summary :` heading — one line per date the log covers. Source `{token}` from the still-present checkpoint filenames in the `Skipped {A} checkpoint file(s)` block above (pattern: `YYYY-MM-DD-{token}-checkpoint-NN.md`). Then fix `consumed:` so it lists **exactly** the checkpoints whose content the log actually contains, each with the first 16 hex characters of `shasum -a 256 <checkpoint>`. **Derive the list by reading the log, never by listing the directory.** An entry for content the log does not hold is the one repair that loses data.
>
> 2. **Discard and let the next /wrapup re-recover.** Delete **the recovered log only, and keep every checkpoint file.** The next /wrapup re-processes those checkpoints from scratch and writes a fresh log. ⚠️ **Never delete the checkpoints as part of this option** — the log and the checkpoints are the only two copies of that history, and once the checkpoints are gone there is nothing left for the "re-recover" to read.

---

## In-Skill Examples

**Good Key Decisions section** (enough detail to reconstruct what happened):
```markdown
## Key Decisions

- Chose $PPID as session token because it is stable within a shell session and unique per terminal window
- Delete checkpoints directly after the session log write succeeds — the written log is the recovery proof, no `merged:` annotation needed
- Kept the state-file reset bash snippet in Step 4 rather than a hook, to avoid hook-ordering issues
```

**Bad Key Decisions section** (too vague to be useful later):
```markdown
## Key Decisions

- Fixed a bug
- Made some changes to wrapup
- Updated the session handling
```

## Known Gotchas

- **Orphan checkpoints from a different token.** Rare case: if the vault was used before CLI v2.0.10 (which fixed the token mismatch between `session-init` and the stop hook), checkpoint files may exist under a different token than the current session. If Step 1 finds no checkpoints but you expect some, look for date-matching checkpoint files in the folder with any token and offer to synthesize them manually.

- **Cross-month midnight sessions (post-v2.4.0).** Checkpoints live flat in `[logs_folder]/checkpoint/`, so no folder math is required — and Step 1 no longer globs by date at all — it matches on the **token** with no date filter, so a session spanning any number of days (or a month/year boundary) needs no date arithmetic whatsoever. The previous `YYYY_PREV/MM_PREV` folder math, and the yesterday-glob that replaced it, are both obsolete: a date-bounded scan silently stranded the checkpoints of any session that ran longer than two days.

- **Pre-v2.2.0 checkpoint files with `merged:` field.** Older vaults may contain checkpoint files that have a `merged: false` or `merged: true` frontmatter field from earlier wrapup runs. The new flow ignores this field entirely — any checkpoint file that exists at /wrapup time is treated as unmerged, regardless of the field's value. The 14-day-old check in /doctor catches any stragglers regardless of the field.

- **Duplicate session slot collision.** If auto-save and a manual /wrapup run nearly simultaneously, both may try to write `session-01.md`. Step 2 already verifies the slot is free before writing — do not skip this check even when synthesizing from checkpoints.

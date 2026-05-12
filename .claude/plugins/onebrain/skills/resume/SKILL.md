---
name: resume
description: "Load the latest snapshot of an active pause thread and announce its state in chat. Use when user signals they want to continue work that was paused — 'resume', 'กลับมาทำต่อ', 'pick up', 'continue from where I left off', 'ที่ค้างไว้'. Reads from 07-logs/pause/. Idempotent — running in same session as the pause is a no-op. Do NOT use for: starting fresh work (just talk), recap of past sessions (use /distill or /search), promoting insights (use /recap)."
schedulable: false
---

# /resume — Load Active Pause Thread (TL;DR)

Reads the latest snapshot of the active pause thread and announces its state in chat so the agent and user can pick up seamlessly. Has no effect if there is no active thread.

---

## Step 1: Resolve Active Thread

1. Read `[logs_folder]/pause/_active.md`. If absent or empty → output "No active pause. คุยใหม่ได้เลย" and stop.
2. Parse the single-line content as `active_slug`.
3. If `/resume --task=<slug>` was invoked with explicit slug → use `<slug>` and overwrite `_active.md` to match (this enables switching from one paused thread to another).

---

## Step 2: Locate Latest Pause File

1. Glob `[logs_folder]/pause/*-{active_slug}-pause-*.md`.
2. Sort by NN descending (tiebreak: date prefix descending). Pick the first.
3. If no file matches (orphan pointer): output "⚠️ Active pointer references `<slug>` but no pause file found. Run /doctor." and stop.

---

## Step 3: Idempotency Check

1. Read the file's frontmatter `session_token`.
2. If it equals the current session token → output "Still in active thread `<slug>`. Already resumed." and stop. Do NOT re-announce content.

---

## Step 4: Load & Announce

Read the file. Extract: `## Where I Stopped`, `## Resume With`, `## Key Decisions`, count of `## Action Items` items (lines matching `- [ ] `), count of `## Open Questions` items.

Output (Interactive profile — full markdown rendering, agent treats this as loaded working context for the next user message):

```
🔄 Resumed from {slug}-pause-{NN} ({YYYY-MM-DD})

**Where I Stopped:** {text}

**Resume With:** {text}

**Key Decisions (last pause):**
- {bullet}
- {bullet}

**Open Questions:** {Q_count} · **Action Items:** {A_count}

พร้อมทำต่อ — เริ่มเลย
```

After announcing, the agent treats the loaded content as the active context for the upcoming user turn. Do NOT re-read the pause file on the next user message unless the user explicitly asks for details not announced.

---
name: schedule-list
description: Show all scheduled OneBrain skills with their cron schedule and last/next run times.
schedulable: false
---

# /schedule-list — Show scheduled skills

## Purpose

Display a formatted summary of all skills currently registered in the `schedule:` block of vault.yml, enriched with last-run and next-run information from launchd or the scheduler state file.

---

## Skill flow

### Step 1: Read vault.yml

Read vault.yml from the vault root. Locate the `schedule:` block.

If vault.yml does not exist or has no `schedule:` block, or the block is empty:

```
No scheduled skills found.

→ Run /schedule-add to set one up.
```

Stop.

### Step 2: Fetch status

Run from the vault root:
```
onebrain register-schedule --status
```

Parse the JSON output. Expected shape per entry:
```json
{
  "skill": "/daily",
  "cron": "0 9 * * *",
  "last_run": "2026-05-11T09:00:00",
  "last_status": "success",
  "next_run": "2026-05-12T09:00:00",
  "paused": false
}
```

If `onebrain register-schedule --status` is unavailable or fails: fall back to reading launchd plist modification times from `~/Library/LaunchAgents/` for each scheduled entry. If neither source is available, show only the cron expressions from vault.yml and omit last/next run columns.

### Step 3: Format output

Print the schedule table:

```
📅 Scheduled skills:

  ✓ 0 9 * * *      /daily         next: tomorrow 09:00   last: 2026-05-11 09:00 (success)
  ✓ 0 18 * * 5     /weekly        next: Friday 18:00     last: 2026-05-08 18:00 (success)
  ✓ 0 12 * * 0     /recap         next: Sunday 12:00     last: 2026-05-10 12:00 (success)
```

Column layout:
- Status icon: `✓` for active, `⏸` for paused
- Cron expression (left-padded to align)
- Skill name
- Next run (human-readable: "tomorrow HH:MM", "Friday HH:MM", "in 3 days HH:MM")
- Last run datetime + status (`success` | `error` | `never`)

### Step 4: Surface errors and paused entries

If `last_status` is `error`:
- Show `(error)` in the last-run column
- Append a hint line below the table: `→ See 07-logs/scheduler/YYYY/MM/YYYY-MM-DD-{skill}.err.md for details`

If `paused` is `true` (auto-paused after 3 consecutive failures):
- Show `⏸ paused` status icon instead of `✓`
- Append a hint line: `→ Fix the error, then run /schedule-add to re-register {skill}`

### Step 5: Footer

After the table, append:
```
→ /schedule-add   add a new scheduled skill
→ /schedule-remove   remove an entry
```

---

## Edge cases

- **No entries at all** — handled in Step 1; early exit with helpful message.
- **Status command unavailable** — graceful fallback to vault.yml data only (Step 2).
- **Partial status** — some entries return status, others don't; show what's available and mark unknowns as `(unknown)`.
- **Cron alignment** — pad cron columns to the longest expression in the list for readable alignment.

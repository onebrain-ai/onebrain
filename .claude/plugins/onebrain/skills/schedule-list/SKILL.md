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

Read the `schedule:` block from vault.yml directly to get the cron/at expression and skill name for each entry.

Optionally run from the vault root:
```
onebrain register-schedule --status
```

This emits plain text (not JSON). Parse line-by-line to extract the installed-on-disk marker (`✓` = plist exists on disk, `✗` = plist missing) for each entry. The CLI does not track last-run, next-run, or last-status — that detail is in `[logs_folder]/scheduler/YYYY/MM/`.

If `onebrain register-schedule --status` is unavailable or fails: fall back to checking launchd plist existence in `~/Library/LaunchAgents/` for each entry. If neither source is available, show only the cron/at expressions from vault.yml and omit the installed-status column.

### Step 3: Format output

Print the schedule table:

```
📅 Scheduled skills:

  ✓ 0 9 * * *      /daily         (installed)
  ✓ 0 18 * * 5     /weekly        (installed)
  ✗ 0 12 * * 0     /recap         (plist missing — re-run /schedule-add)
```

Column layout:
- Installed icon: `✓` = plist on disk, `✗` = plist missing
- Cron or at expression (left-padded to align)
- Skill name
- Installed status note

Detailed run history (stdout, stderr, error files) lives in `[logs_folder]/scheduler/YYYY/MM/`.

### Step 4: Surface errors

If `✗` entries are found:
- Append a hint line below the table: `→ Run /schedule-add to re-register missing entries`

For error log detail:
- Append: `→ See [logs_folder]/scheduler/YYYY/MM/YYYY-MM-DD-{skill}.err.md for failure details`

Note: auto-pause-on-failure (⏸ paused after 3 consecutive failures) is not yet implemented in the CLI. The marker file mechanism is planned for a future release. `/doctor` currently flags 3+ consecutive `.err.md` files as CRITICAL — use that for failure monitoring.

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

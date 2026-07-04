# Schedule Presets — Canonical Tier Definitions

Used by `/schedule-add` (Step 0 first-run path) and `/onboarding` (preset selection step). This file is the single source of truth — when a preset entry changes, change it here only.

All entries assume macOS launchd. Skill mode and command mode (hook-style) coexist; Tier 3 demonstrates both.

## Tier 1 — Minimal (1 entry)

```yaml
schedule:
  - cron: "0 9 * * *"      # all days 09:00 — daily briefing
    skill: /daily
```

## Tier 2 — Essentials (3 entries) — default Recommended

```yaml
schedule:
  - cron: "0 9 * * *"      # all days 09:00 — daily briefing
    skill: /daily
  - cron: "0 17 * * 5"     # Friday 17:00 — workday-end weekly review
    skill: /weekly
  - cron: "0 12 * * 0"     # Sunday 12:00 — weekend reflection (promote insights)
    skill: /recap
```

## Tier 3 — Maintenance Plus (6 entries — mix of skill + command modes)

```yaml
schedule:
  - cron: "0 9 * * *"      # all days 09:00 — daily briefing
    skill: /daily
  - cron: "0 17 * * 5"     # Friday 17:00 — weekly review (workday end)
    skill: /weekly
  - cron: "0 12 * * 0"     # Sunday 12:00 — recap (weekend reflection)
    skill: /recap
  - cron: "0 9 1 * *"      # 1st of month 09:00 — monthly health audit
    skill: /doctor
  - cron: "0 6 * * *"      # all days 06:00 — pre-work tasks dashboard refresh
    skill: /tasks
  - cron: "0 3 * * 0"      # Sunday 03:00 — search embed safety-net sweep (CLI command, hook-style)
    command: onebrain
    args: [search, reindex]
```

## Tier 4 — Custom

No preset entries. Drop the user into the regular `/schedule-add` wizard for manual construction.

## Time-of-day rationale

| Hour | Used by | Why |
|---|---|---|
| 03:00 | command search reindex (Sunday) | Quiet pre-dawn maintenance — no editing conflicts |
| 06:00 | /tasks (daily) | Pre-work dashboard refresh — ready before 09:00 |
| 09:00 | /daily (daily), /doctor (monthly) | Start-of-day briefing window |
| 12:00 | /recap (Sunday) | Weekend mid-day quiet reflection |
| 17:00 | /weekly (Friday) | Workday-end wrap-the-week signal |

Schedules are staggered across the day so launchd never spawns multiple OneBrain jobs simultaneously.

## Skill mode vs command mode (see INSTRUCTIONS.md for full spec)

| Mode | Use case | Shape |
|---|---|---|
| `skill:` | OneBrain skills with `schedulable: true` frontmatter | `skill: /daily`, optional `args: { key: value }` map |
| `command:` | CLI binaries / generic maintenance commands | `command: onebrain`, optional `args: [arg1, arg2]` string array |

Both modes coexist in the same `schedule:` block (Tier 3 demonstrates).

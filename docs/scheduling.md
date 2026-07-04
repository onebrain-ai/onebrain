# Scheduling

Run OneBrain skills automatically on a recurring or one-shot schedule via your OS scheduler.

> Part of [OneBrain docs](README.md)

OneBrain skills can run automatically on a schedule via your OS scheduler (macOS launchd; Linux + Windows coming soon). Configure in `onebrain.yml`:

```yaml
schedule:
  - cron: "0 9 * * *"      # daily 9am
    skill: /daily
  - cron: "0 18 * * 5"     # Friday 6pm
    skill: /weekly
  - cron: "0 12 * * 0"     # Sunday noon
    skill: /recap
```

For a one-shot reminder, use `at:` instead of `cron:`:

```yaml
schedule:
  - at: "2026-05-13 14:30"
    skill: /reminder
```

After firing, the launchd plist auto-uninstalls itself.

Register schedules:

```bash
onebrain schedule register
```

Or use the interactive wizards from inside your vault:

```
/schedule-add      # recurring schedule wizard
/schedule-once     # one-shot wizard
/schedule-list     # show all scheduled entries
/schedule-remove   # remove an entry
```

Output goes to `[logs_folder]/scheduler/YYYY/MM/YYYY-MM-DD-{skill}.md` as readable markdown.

## Command mode (CLI binaries, hook-style)

For CLI maintenance tasks that aren't OneBrain skills, use the `command + args[]` shape:

```yaml
schedule:
  - cron: "0 3 * * 0"
    command: onebrain
    args: [search, reindex]
  - cron: "0 5 * * *"
    command: rsync
    args: [-av, /vault, /backup]
```

This matches the same shape Claude Code uses for `hooks` in `settings.json` — direct binary invocation with positional argv. No wrapper skill needed.

## Quick start — preset bundles

Don't want to hand-craft cron entries? OneBrain ships three preset tiers. New vaults are prompted during `/onboarding`; existing vaults can trigger the selector by running `/schedule-add` when the `schedule:` block is empty.

- **Minimal** — `/daily` briefing only
- **Essentials (default)** — `/daily` + `/weekly` Friday + `/recap` Sunday
- **Maintenance Plus** — Essentials + `/doctor` monthly + `/tasks` daily + `onebrain search reindex` Sunday (mixes skill + command modes)

Canonical tier definitions live at `.claude/plugins/onebrain/skills/_shared/schedule-presets.md`.

CLI flags:

| Flag | Purpose |
|---|---|
| `--dry-run` | Print plist without writing |
| `--remove` | Remove all OneBrain schedules |
| `--refresh` | Re-emit plists after vault move |
| `--resume <skill>` | Resume an auto-paused skill |
| `--status` | Show registered schedules + run history |
| `--test <skill>` | Manually invoke a scheduled skill once |

**Note:** OneBrain's scheduler is distinct from Claude Code's `/loop` (in-session) and `/schedule` (cloud-hosted). OneBrain runs locally and writes to your vault.

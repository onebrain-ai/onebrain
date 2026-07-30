# Scheduling

Run OneBrain skills automatically on a recurring or one-shot schedule via your OS scheduler.

> Part of [OneBrain docs](README.md)

OneBrain skills can run automatically on a schedule via your OS scheduler — **all three platforms since CLI v3.4.20**: macOS (launchd), Windows (Task Scheduler), Linux (systemd user timers). Every backend registers into your *user* session and is fire-verified on real machines; per-platform semantics (artifacts, missed-run behavior, output capture) are documented in the CLI's [platform-support](https://github.com/onebrain-ai/onebrain-cli/blob/main/docs/platform-support.md). Configure in `onebrain.yml`:

```yaml
schedule:
  - cron: "30 8 * * *"     # morning digest 8:30 (markets/news/Reddit — see /digest)
    skill: /digest
  - cron: "0 9 * * *"      # daily 9am
    skill: /daily
    harness: codex
  - cron: "0 18 * * 5"     # Friday 6pm
    skill: /weekly
  - cron: "0 12 * * 0"     # Sunday noon
    skill: /recap
```

`harness` is optional on skill entries and accepts `claude`, `gemini`, or
`codex`; omission remains `claude`. It is invalid on command-mode entries.
The scheduler forwards it to `onebrain skill run --harness ...`.

For a one-shot firing, use `at:` instead of `cron:` — e.g. run the daily briefing once at a specific datetime:

```yaml
schedule:
  - at: "2026-05-13 14:30"
    skill: /daily
```

After firing, the scheduler artifact deletes itself — on every platform (launchd self-removal · Task Scheduler `DeleteExpiredTaskAfter` · systemd `ExecStopPost`).

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

## Where scheduled output goes

Three layers (CLI v3.4.20 + plugin v3.4.7):

1. **Vault skill log** — the run's primary output is appended to `[logs_folder]/log/YYYY/MM/YYYY-MM-DD-{skill}.md`: searchable, `/recap`-visible, readable anywhere your vault syncs. This is the deliverable.
2. **Telegram (opt-in)** — set `notifications.telegram_chat_id` in `onebrain.yml` and every scheduled skill run also sends its output to that chat. Best-effort: a send failure never fails the run. Setup is a capture, not a hunt — `/digest` (first run), `/schedule-add`, and `/onboarding` all offer it when the Telegram channel is configured: you send the bot one message and OneBrain records the chat id for you.

   ```yaml
   notifications:
     telegram_chat_id: "123456789"   # unset = vault log only
   ```

3. **Raw process logs** — stdout/stderr land in the OS state dir (`~/Library/Logs/onebrain` on macOS · journald on Linux · Task Scheduler history on Windows), deliberately **outside** the vault: a cloud-synced vault once made launchd fail every run silently (onebrain-cli #315). Failures also write `[logs_folder]/scheduler/**/*.err.md`, which `/doctor` and session startup surface.

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
| `--dry-run` | Print the scheduler artifact(s) without writing |
| `--remove` | Remove all OneBrain schedules |
| `--refresh` | Re-emit scheduler artifacts after a vault move |
| `--resume <skill>` | Resume an auto-paused skill |
| `--status` | Show registered schedules + run history |
| `--test <skill>` | Manually invoke a scheduled skill once |

**Note:** OneBrain's scheduler is distinct from Claude Code's `/loop` (in-session) and `/schedule` (cloud-hosted). OneBrain runs locally and writes to your vault.

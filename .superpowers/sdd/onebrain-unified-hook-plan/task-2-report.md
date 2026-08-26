# Task 2 report — migrate plugin lifecycle registrations

## Implementation

- Updated Codex `SessionStart`, `PostToolUse`, and single `Stop` registration to use exactly `onebrain hook` on POSIX and Windows.
- Added `onebrain hook` to Claude `SessionStart` while retaining the CLI-version check and both independent PreToolUse hooks.
- Added Gemini `SessionStart` (`startup`), `AfterTool` (`write_file|replace`), and `AfterAgent` (`*`) registrations, all using bare `onebrain hook`; removed redirects and `echo '{}'` wrappers.
- Renamed the validator to `scripts/check-lifecycle-hooks.py`, expanded it to all three harnesses, and updated `.github/workflows/ci.yml`.
- Validator now checks exact registration counts/commands, preservation of Claude independent hooks, full hook payload forwarding, SessionStart context, `{}` tool/unsupported-event output, Stop protocol output, and operation after deleting the plugin-cache directory.
- Updated `INSTRUCTIONS.md`, `CONTRIBUTING.md`, `GEMINI.md`, `docs/install.md`, `docs/memory.md`, and the current `CHANGELOG.md` entry to document the shared lifecycle command and the required new agent session after upgrading. The old `codex-hook` alias is explicitly documented as absent.

## TDD evidence

RED test/contract command:

```text
$ python3 scripts/check-lifecycle-hooks.py
Traceback (most recent call last):
  File "/private/tmp/onebrain-codex-hook-plugin/scripts/check-lifecycle-hooks.py", line 40, in <module>
    assert_unified_command(commands[0], f"Codex {event}")
  File "/private/tmp/onebrain-codex-hook-plugin/scripts/check-lifecycle-hooks.py", line 29, in assert_unified_command
    assert command["command"] == "onebrain hook", f"{event} must call onebrain hook"
AssertionError: Codex SessionStart must call onebrain hook
```

RED exit status: `1`.

After implementing the manifests and validator behavior, the same command produced:

```text
$ python3 scripts/check-lifecycle-hooks.py
lifecycle hooks ok
```

GREEN exit status: `0`.

## Validation

All commands below completed with exit status `0`:

- `python3 scripts/check-lifecycle-hooks.py` — `lifecycle hooks ok`
- `python3.11 scripts/check-config.py` — `Config OK — all tracked JSON/TOML parse; manifest keys present.`
- `python3.11 scripts/check-links.py` — `Links OK — all relative Markdown links resolve.`
- `python3.11 scripts/check-skill-count.py` — `Skill count OK — 31 skills, docs consistent, table rows 32`
- `python3 -B` AST parse of `scripts/check-lifecycle-hooks.py` — `python syntax ok`
- `git diff --check`
- Direct JSON parsing of all three changed manifests.

The repository's default macOS `python3` is Python 3.9, so `check-config.py` correctly reported that `tomllib` was unavailable; Python 3.11 was used for the repository static checks. `python3 -m py_compile` was not used for the final syntax check because the system interpreter attempted to write an inaccessible user cache; the no-write AST parse passed.

## Self-review

- Confirmed no shipped manifest contains a mode-suffixed `codex-hook` invocation or Gemini shell redirect/fallback wrapper.
- Confirmed Codex has exactly one command each for `SessionStart`, `PostToolUse`, and `Stop`; the Stop command is not duplicated.
- Confirmed Claude's version check, `read-hook.sh`, and `grep-gate.sh` registrations remain present.
- Confirmed validator and CI no longer reference the deleted `check-codex-hooks.py`; the replacement validator is the only caller.
- Confirmed no files under `/private/tmp/onebrain-codex-hook-cli` were edited.
- `git diff --check` is clean.

## Concerns

- Runtime behavior depends on the companion CLI's hidden `onebrain hook` command from Task 1 and its `hook_event_name` stdin contract; the plugin declares the existing CLI floor `>=3.4.25`.
- The default local Python 3.9 environment cannot perform TOML validation; CI's Python 3.11+ environment is the supported validation environment.

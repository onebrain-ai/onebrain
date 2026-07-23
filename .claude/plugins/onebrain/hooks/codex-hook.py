#!/usr/bin/env python3
"""Bridge Codex hook `session_id` into OneBrain's session-token environment.

Always exits zero: hooks must not block a user turn when the CLI or index is
unavailable.
"""

import json
import os
import subprocess
import sys

MIN_CLI = (3, 4, 18)


def onebrain_command():
    return os.environ.get("ONEBRAIN_BIN", "onebrain")


def additional_context(message):
    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "additionalContext": message,
            }
        },
        sys.stdout,
    )


def cli_is_compatible(env):
    try:
        proc = subprocess.run(
            [onebrain_command(), "--version"],
            env=env,
            capture_output=True,
            text=True,
            check=False,
            timeout=3,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if proc.returncode != 0:
        return None
    text = f"{proc.stdout} {proc.stderr}"
    for word in text.split():
        parts = word.lstrip("v").split(".")
        if len(parts) >= 3 and all(part.isdigit() for part in parts[:3]):
            return tuple(map(int, parts[:3])) >= MIN_CLI
    return None


def run(mode, *args):
    env = os.environ.copy()
    command_timeout = 2 if mode in ("lex", "pending") else 7
    try:
        payload = json.load(sys.stdin)
    except Exception:
        payload = {}
    session_id = payload.get("session_id")
    if isinstance(session_id, str) and session_id:
        env["CODEX_SESSION_ID"] = session_id
    if mode == "session-start":
        compatible = cli_is_compatible(env)
        if compatible is False:
            additional_context(
                "OneBrain Codex hooks require CLI >= 3.4.18. Run `onebrain update`, "
                "then start a new Codex chat. Checkpoint and wrapup isolation are "
                "disabled in this chat to avoid mixing session identities."
            )
            return
    try:
        proc = subprocess.run(
            [onebrain_command(), *args],
            env=env,
            capture_output=True,
            text=True,
            check=False,
            timeout=command_timeout,
        )
    except (OSError, subprocess.TimeoutExpired):
        return
    if proc.returncode != 0:
        return
    if mode == "session-start" and proc.stdout.strip():
        try:
            data = json.loads(proc.stdout)
            token = data.get("session_token")
            if token is None and isinstance(data.get("data"), dict):
                token = data["data"].get("session_token")
            if isinstance(token, str) and token:
                additional_context(
                    f"OneBrain Codex session_token: {token}. Preserve this token for "
                    "checkpoint and wrapup isolation in this chat. During startup, "
                    "invoke the executable in ONEBRAIN_BIN (never a bare `onebrain`): "
                    f"POSIX `\"$ONEBRAIN_BIN\" session init --json --session-token {token}`; "
                    f"Windows PowerShell `& $env:ONEBRAIN_BIN session init --json --session-token {token}`. "
                    "Use ONEBRAIN_BIN for every later OneBrain CLI call in this chat so "
                    "metadata collection cannot replace the hook-derived identity."
                )
        except Exception:
            return
    elif mode == "checkpoint" and proc.stdout.strip():
        sys.stdout.write(proc.stdout)


mode = sys.argv[1] if len(sys.argv) > 1 else ""
if mode == "session-start":
    run(mode, "session", "init", "--json")
elif mode == "checkpoint":
    run(mode, "checkpoint", "stop", "--json")
elif mode == "lex":
    run(mode, "search", "reindex", "--lex-only", "--json")
elif mode == "pending":
    run(mode, "search", "reindex", "--pending-only", "--json")

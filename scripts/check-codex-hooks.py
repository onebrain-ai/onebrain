#!/usr/bin/env python3
"""Validate Codex hook manifests and their cache-independent lifecycle."""

from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
HOOKS_PATH = ROOT / ".claude/plugins/onebrain/hooks/codex-hooks.json"
EXPECTED_MODES = {
    "SessionStart": ["session-start"],
    "PostToolUse": ["lex"],
    "Stop": ["checkpoint", "pending"],
}


def commands_for(manifest: dict, event: str) -> list[dict]:
    return [
        hook
        for matcher in manifest["hooks"][event]
        for hook in matcher["hooks"]
    ]


manifest = json.loads(HOOKS_PATH.read_text())
for event, modes in EXPECTED_MODES.items():
    commands = commands_for(manifest, event)
    assert len(commands) == len(modes), f"unexpected {event} hook count"
    for command, mode in zip(commands, modes):
        expected = f"onebrain codex-hook {mode}"
        assert command["command"] == expected, (
            f"{event} must call the installed CLI, not a versioned plugin-cache file"
        )
        assert command["commandWindows"] == expected, (
            f"{event} Windows hook must call the installed CLI"
        )


with tempfile.TemporaryDirectory() as temp_dir:
    temp = Path(temp_dir)
    fake_bin = temp / "bin"
    fake_bin.mkdir()
    calls_path = temp / "calls.jsonl"
    fake_onebrain = fake_bin / "onebrain"
    fake_onebrain.write_text(
        """#!/usr/bin/env python3
import json
import os
import sys

payload = json.load(sys.stdin)
mode = sys.argv[2]
with open(os.environ["FAKE_ONEBRAIN_CALLS"], "a", encoding="utf-8") as handle:
    handle.write(json.dumps({"args": sys.argv[1:], "session_id": payload.get("session_id")}) + "\\n")
if mode == "session-start":
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": f"session={payload.get('session_id')}",
    }}))
elif mode == "checkpoint":
    print(json.dumps({"continue": True}))
"""
    )
    fake_onebrain.chmod(0o755)

    # Reproduce the real failure mode: Codex keeps the command after the plugin
    # manager deletes the versioned cache directory it originally came from.
    deleted_plugin_root = temp / "plugin-cache" / "onebrain" / "3.4.4"
    shutil.copytree(ROOT / ".claude/plugins/onebrain", deleted_plugin_root)
    shutil.rmtree(deleted_plugin_root)

    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}{os.pathsep}{env.get('PATH', '')}"
    env["CLAUDE_PLUGIN_ROOT"] = str(deleted_plugin_root)
    env["FAKE_ONEBRAIN_CALLS"] = str(calls_path)

    def run(event: str, index: int, session_id: str) -> subprocess.CompletedProcess[str]:
        command = commands_for(manifest, event)[index]["command"]
        result = subprocess.run(
            command,
            shell=True,
            check=False,
            input=json.dumps({"session_id": session_id}),
            text=True,
            capture_output=True,
            env=env,
        )
        assert result.returncode == 0, result.stderr
        return result

    first = run("SessionStart", 0, "codex-a")
    second = run("SessionStart", 0, "codex-b")
    assert json.loads(first.stdout)["hookSpecificOutput"]["additionalContext"] == "session=codex-a"
    assert json.loads(second.stdout)["hookSpecificOutput"]["additionalContext"] == "session=codex-b"
    assert run("PostToolUse", 0, "codex-a").stdout == ""
    run("Stop", 0, "codex-a")
    assert run("Stop", 1, "codex-a").stdout == ""

    calls = [json.loads(line) for line in calls_path.read_text().splitlines()]
    assert [call["args"] for call in calls] == [
        ["codex-hook", "session-start"],
        ["codex-hook", "session-start"],
        ["codex-hook", "lex"],
        ["codex-hook", "checkpoint"],
        ["codex-hook", "pending"],
    ]

print("codex hooks ok")

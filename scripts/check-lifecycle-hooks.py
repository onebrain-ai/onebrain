#!/usr/bin/env python3
"""Validate unified OneBrain lifecycle registrations across all harnesses."""

from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
CODEX_HOOKS_PATH = ROOT / ".claude/plugins/onebrain/hooks/codex-hooks.json"
CLAUDE_HOOKS_PATH = ROOT / ".claude/plugins/onebrain/hooks/hooks.json"
GEMINI_SETTINGS_PATH = ROOT / ".gemini/settings.json"


def commands_for(manifest: dict, event: str) -> list[dict]:
    return [
        hook
        for matcher in manifest["hooks"][event]
        for hook in matcher["hooks"]
    ]


def assert_unified_command(command: dict, event: str) -> None:
    assert command["command"] == "onebrain hook", f"{event} must call onebrain hook"
    if "commandWindows" in command:
        assert command["commandWindows"] == "onebrain hook", (
            f"{event} Windows hook must call onebrain hook"
        )


codex_manifest = json.loads(CODEX_HOOKS_PATH.read_text(encoding="utf-8"))
for event in ("SessionStart", "PostToolUse", "Stop"):
    commands = commands_for(codex_manifest, event)
    assert len(commands) == 1, f"Codex must have one {event} command"
    assert_unified_command(commands[0], f"Codex {event}")

assert codex_manifest["hooks"]["PostToolUse"][0]["matcher"] == "Edit|Write|apply_patch"

claude_manifest = json.loads(CLAUDE_HOOKS_PATH.read_text(encoding="utf-8"))
claude_session_commands = commands_for(claude_manifest, "SessionStart")
assert len(claude_session_commands) == 2, "Claude SessionStart must retain both lifecycle hooks"
assert any(
    command["command"] == "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/check-cli-version.sh\""
    for command in claude_session_commands
), (
    "Claude SessionStart must retain the CLI version check"
)
assert sum(command["command"] == "onebrain hook" for command in claude_session_commands) == 1, (
    "Claude SessionStart must add exactly one generic lifecycle hook"
)
assert [
    command["command"]
    for command in commands_for(claude_manifest, "PreToolUse")
] == [
    "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/read-hook.sh\"",
    "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/grep-gate.sh\"",
], "Claude independent PreToolUse hooks changed unexpectedly"

gemini_settings = json.loads(GEMINI_SETTINGS_PATH.read_text(encoding="utf-8"))
for event in ("SessionStart", "AfterTool", "AfterAgent"):
    groups = gemini_settings["hooks"].get(event, [])
    assert len(groups) == 1, f"Gemini must have one {event} group"
    commands = commands_for(gemini_settings, event)
    assert len(commands) == 1, f"Gemini must have one {event} command"
    assert_unified_command(commands[0], f"Gemini {event}")
assert "matcher" not in gemini_settings["hooks"]["SessionStart"][0], (
    "Gemini SessionStart must be unfiltered so startup, resume, and clear all run "
    "the shared lifecycle hook"
)
assert gemini_settings["hooks"]["AfterTool"][0]["matcher"] == "write_file|replace"
assert gemini_settings["hooks"]["AfterAgent"][0]["matcher"] == "*"


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
with open(os.environ["FAKE_ONEBRAIN_CALLS"], "a", encoding="utf-8") as handle:
    handle.write(json.dumps({"args": sys.argv[1:], "payload": payload}) + "\\n")
event = payload.get("hook_event_name")
if event == "SessionStart":
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": f"session={payload.get('session_id')}",
    }}))
elif event == "Stop" or event == "AfterAgent":
    print(json.dumps({"decision": "block", "reason": "checkpoint due"}))
else:
    print("{}")
"""
    )
    fake_onebrain.chmod(0o755)

    deleted_plugin_root = temp / "plugin-cache" / "onebrain" / "3.4.4"
    shutil.copytree(ROOT / ".claude/plugins/onebrain", deleted_plugin_root)
    shutil.rmtree(deleted_plugin_root)

    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}{os.pathsep}{env.get('PATH', '')}"
    env["CLAUDE_PLUGIN_ROOT"] = str(deleted_plugin_root)
    env["FAKE_ONEBRAIN_CALLS"] = str(calls_path)

    full_payload = {
        "session_id": "lifecycle-session",
        "transcript_path": "/tmp/session.jsonl",
        "cwd": "/tmp/vault",
        "hook_event_name": "SessionStart",
        "timestamp": "2026-08-26T10:00:00Z",
        "model": "gpt-5.6-sol",
        "permission_mode": "default",
    }

    def run(command: str, payload: dict) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(
            command,
            shell=True,
            check=False,
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            env=env,
        )
        assert result.returncode == 0, result.stderr
        return result

    session_start = run(
        codex_manifest["hooks"]["SessionStart"][0]["hooks"][0]["command"],
        full_payload,
    )
    assert json.loads(session_start.stdout)["hookSpecificOutput"]["additionalContext"] == "session=lifecycle-session"

    tool_payload = {**full_payload, "hook_event_name": "PostToolUse"}
    tool = run(codex_manifest["hooks"]["PostToolUse"][0]["hooks"][0]["command"], tool_payload)
    assert json.loads(tool.stdout) == {}, "tool lifecycle output must be an empty JSON object"

    no_op_payload = {**full_payload, "hook_event_name": "BeforeTool"}
    no_op = run(
        codex_manifest["hooks"]["SessionStart"][0]["hooks"][0]["command"],
        no_op_payload,
    )
    assert json.loads(no_op.stdout) == {}, "unsupported lifecycle events must be no-ops"

    stop_payload = {**full_payload, "hook_event_name": "Stop"}
    stop = run(codex_manifest["hooks"]["Stop"][0]["hooks"][0]["command"], stop_payload)
    assert json.loads(stop.stdout) == {"decision": "block", "reason": "checkpoint due"}

    for manifest, events in (
        (claude_manifest, (("SessionStart", None),)),
        (
            gemini_settings,
            (
                ("SessionStart", "startup"),
                ("SessionStart", "resume"),
                ("SessionStart", "clear"),
                ("AfterTool", None),
                ("AfterAgent", None),
            ),
        ),
    ):
        for event, source in events:
            command = next(
                command
                for command in commands_for(manifest, event)
                if command["command"] == "onebrain hook"
            )
            payload = {**full_payload, "hook_event_name": event}
            if source is not None:
                payload["source"] = source
            output = run(command["command"], payload)
            if event == "SessionStart":
                assert "hookSpecificOutput" in json.loads(output.stdout)
            elif event == "AfterAgent":
                assert json.loads(output.stdout)["decision"] == "block"
            else:
                assert json.loads(output.stdout) == {}

    calls = [json.loads(line) for line in calls_path.read_text(encoding="utf-8").splitlines()]
    assert all(call["args"] == ["hook"] for call in calls)
    assert all(
        set(call["payload"]) >= set(full_payload)
        for call in calls
    ), "lifecycle commands did not receive the full event payload"
    assert [call["payload"]["hook_event_name"] for call in calls] == [
        "SessionStart",
        "PostToolUse",
        "BeforeTool",
        "Stop",
        "SessionStart",
        "SessionStart",
        "SessionStart",
        "SessionStart",
        "AfterTool",
        "AfterAgent",
    ]

print("lifecycle hooks ok")

#!/usr/bin/env python3
"""Exercise Codex hook session binding with two independent chat IDs."""

import json
import os
import pathlib
import stat
import subprocess
import sys
import tempfile


root = pathlib.Path(__file__).resolve().parents[1]
hook = root / ".claude/plugins/onebrain/hooks/codex-hook.py"
hooks_config = root / ".claude/plugins/onebrain/hooks/codex-hooks.json"

hooks_text = hooks_config.read_text(encoding="utf-8")
if "CODEX_PLUGIN_ROOT" in hooks_text or "CLAUDE_PLUGIN_ROOT" not in hooks_text:
    raise SystemExit(
        "Codex hooks must use CLAUDE_PLUGIN_ROOT, the plugin-root variable "
        "provided by the Codex plugin runtime"
    )

with tempfile.TemporaryDirectory() as tmp:
    tmp = pathlib.Path(tmp)
    fake = tmp / "onebrain"
    fake.write_text(
        "#!/bin/sh\n"
        "if [ \"$1\" = \"--version\" ]; then\n"
        "  printf 'onebrain 3.4.18\\n'\n"
        "else\n"
        "  printf '{\"session_token\":\"%s\"}' \"$CODEX_SESSION_ID\"\n"
        "fi\n",
        encoding="utf-8",
    )
    fake.chmod(fake.stat().st_mode | stat.S_IXUSR)
    env = os.environ.copy()
    env["PATH"] = f"{tmp}{os.pathsep}{env.get('PATH', '')}"
    env["ONEBRAIN_BIN"] = str(fake)

    outputs = []
    for session_id in ("same-prefix-chat-a", "same-prefix-chat-b"):
        proc = subprocess.run(
            [sys.executable, str(hook), "session-start"],
            input=json.dumps({"session_id": session_id}),
            text=True,
            capture_output=True,
            env=env,
            check=True,
        )
        output = json.loads(proc.stdout)
        outputs.append(output["hookSpecificOutput"]["additionalContext"])

    if not (
        "same-prefix-chat-a" in outputs[0]
        and "same-prefix-chat-b" in outputs[1]
        and "--session-token same-prefix-chat-a" in outputs[0]
        and "--session-token same-prefix-chat-b" in outputs[1]
        and outputs[0] != outputs[1]
    ):
        raise SystemExit(f"Codex session binding failed: {outputs!r}")

    fake.write_text(
        "#!/bin/sh\n"
        "if [ \"$1\" = \"--version\" ]; then\n"
        "  printf 'onebrain 3.4.17\\n'\n"
        "else\n"
        "  exit 99\n"
        "fi\n",
        encoding="utf-8",
    )
    proc = subprocess.run(
        [sys.executable, str(hook), "session-start"],
        input=json.dumps({"session_id": "old-cli-chat"}),
        text=True,
        capture_output=True,
        env=env,
        check=True,
    )
    warning = json.loads(proc.stdout)["hookSpecificOutput"]["additionalContext"]
    if "require CLI >= 3.4.18" not in warning:
        raise SystemExit(f"Codex CLI version gate failed: {warning!r}")

print("Codex hooks OK — distinct chat session_id values remain isolated.")

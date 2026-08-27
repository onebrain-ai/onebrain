#!/usr/bin/env python3
"""Regression checks for the SessionStart CLI version gate."""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
CHECKER = ROOT / ".claude/plugins/onebrain/hooks/check-cli-version.sh"


def run_check(version: str) -> dict[str, str]:
    with tempfile.TemporaryDirectory() as temp_dir:
        temp = Path(temp_dir)
        onebrain = temp / "onebrain"
        onebrain.write_text(
            f"#!/usr/bin/env bash\nprintf '%s\\n' 'onebrain {version}'\n",
            encoding="utf-8",
        )
        onebrain.chmod(0o755)
        env = os.environ.copy()
        env["PATH"] = f"{temp}{os.pathsep}{env['PATH']}"
        result = subprocess.run(
            ["bash", str(CHECKER)],
            check=False,
            capture_output=True,
            text=True,
            env=env,
        )
        assert result.returncode == 0, result.stderr
        return json.loads(result.stdout) if result.stdout.strip() else {}


assert run_check("3.4.24")["decision"] == "block"
assert run_check("3.4.25-alpha.1").get("decision") == "block"
assert run_check("3.4.25") == {}
assert run_check("3.4.26-alpha.1") == {}

print("CLI version gate ok")

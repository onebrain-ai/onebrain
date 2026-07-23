#!/usr/bin/env python3
"""CI: validate every tracked JSON and TOML file parses, and that the plugin's
manifest files carry their required keys. Pure stdlib — no third-party deps.

A syntax error in plugin.json / marketplace.json / hooks.json / .mcp.json ships
a broken plugin to users, so this is the cheapest high-value gate we have.
"""
import json
import subprocess
import sys

try:
    import tomllib  # py3.11+
except ModuleNotFoundError:  # pragma: no cover
    tomllib = None

REQUIRED = {
    ".claude/plugins/onebrain/.claude-plugin/plugin.json": ["name", "version", "description"],
    ".claude/plugins/onebrain/.codex-plugin/plugin.json": [
        "name", "version", "description", "skills", "mcpServers", "hooks"
    ],
    ".claude-plugin/marketplace.json": ["name", "plugins"],
}


def tracked(*globs):
    out = subprocess.run(
        ["git", "ls-files", *globs], capture_output=True, text=True, check=True
    ).stdout
    return [p for p in out.splitlines() if p]


def main():
    errors = []

    for path in tracked("*.json"):
        try:
            with open(path, encoding="utf-8") as fh:
                data = json.load(fh)
        except (json.JSONDecodeError, OSError) as exc:
            errors.append(f"{path}: invalid JSON — {exc}")
            continue
        for key in REQUIRED.get(path, []):
            if key not in data:
                errors.append(f"{path}: missing required key '{key}'")

    manifests = [
        ".claude/plugins/onebrain/.claude-plugin/plugin.json",
        ".claude/plugins/onebrain/.codex-plugin/plugin.json",
    ]
    versions = []
    for path in manifests:
        try:
            with open(path, encoding="utf-8") as fh:
                versions.append(json.load(fh)["version"])
        except (OSError, KeyError, json.JSONDecodeError) as exc:
            errors.append(f"{path}: cannot compare manifest version — {exc}")
    if len(set(versions)) > 1:
        errors.append(f"manifest versions differ: {versions}")

    toml_files = tracked("*.toml")
    if toml_files:
        if tomllib is None:
            errors.append("tomllib unavailable (need Python 3.11+) — cannot validate TOML")
        else:
            for path in toml_files:
                try:
                    with open(path, "rb") as fh:
                        tomllib.load(fh)
                except (tomllib.TOMLDecodeError, OSError) as exc:
                    errors.append(f"{path}: invalid TOML — {exc}")

    if errors:
        print("Config validation failed:")
        for e in errors:
            print(f"  ✗ {e}")
        sys.exit(1)
    print("Config OK — all tracked JSON/TOML parse; manifest keys present.")


if __name__ == "__main__":
    main()

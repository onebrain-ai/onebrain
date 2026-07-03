#!/usr/bin/env python3
"""CI: verify relative file links in Markdown resolve to a real file.

Conservative by design — only inline `[text](target)` links are checked:
  * `[[wikilinks]]` (Obsidian) have no parens, so they are never matched.
  * external targets (http, https, mailto, tel, //) are skipped.
  * pure `#anchor` targets are skipped; a trailing `#anchor` / `?query` is stripped.
  * fenced ``` code blocks are ignored so documented examples don't false-positive.
Pure stdlib — no third-party deps.
"""
import os
import re
import subprocess
import sys

LINK = re.compile(r"(?<!\!)\[[^\]]*\]\(([^)]+)\)")
SKIP_SCHEMES = ("http://", "https://", "mailto:", "tel:", "//", "#")


def tracked_md():
    out = subprocess.run(
        ["git", "ls-files", "*.md"], capture_output=True, text=True, check=True
    ).stdout
    return [p for p in out.splitlines() if p]


def strip_code(text):
    """Blank out fenced code blocks so example links inside them are ignored."""
    lines, out, fence = text.splitlines(), [], False
    for ln in lines:
        if ln.lstrip().startswith("```"):
            fence = not fence
            out.append("")
            continue
        out.append("" if fence else ln)
    return "\n".join(out)


def main():
    errors = []
    for md in tracked_md():
        base = os.path.dirname(md)
        with open(md, encoding="utf-8") as fh:
            body = strip_code(fh.read())
        for target in LINK.findall(body):
            t = target.strip().split()[0]  # drop optional "title"
            if t.startswith(SKIP_SCHEMES) or not t:
                continue
            t = t.split("#", 1)[0].split("?", 1)[0]
            if not t:
                continue
            root = base if not t.startswith("/") else "."
            resolved = os.path.normpath(os.path.join(root, t.lstrip("/")))
            if not os.path.exists(resolved):
                errors.append(f"{md}: broken link → {target}")

    if errors:
        print("Broken Markdown links:")
        for e in errors:
            print(f"  ✗ {e}")
        sys.exit(1)
    print("Links OK — all relative Markdown links resolve.")


if __name__ == "__main__":
    main()

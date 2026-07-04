#!/usr/bin/env python3
"""CI: verify the documented skill count matches the actual skills/ directory.

Convention: the "skill count" is the number of directories under
`.claude/plugins/onebrain/skills/` that contain a `SKILL.md`, excluding
`_shared`, `help`, and `startup` (`/help` is a utility — it is listed in
docs tables but never counted; `_shared` and `startup` are not skills).

This check has drifted repeatedly (29+/31+/31/30) as skills were added
without updating every doc that states the count. It enforces:
  1. Every "<N> skills" / "<N> Skills" mention in README.md and docs/*.md
     equals the actual count.
  2. The command table in docs/skills.md has exactly N+1 rows (the extra
     row is `/help`).
Pure stdlib — no third-party deps.

Known limitations:
  - EXCLUDED is exact-name match ({_shared, help, startup}) — a new underscore-prefixed dir WITH a SKILL.md gets counted (fail-safe by design).
  - Count guard only: a rename (e.g. wrapup -> wrapup-v2) keeps N stable and passes even if docs/skills.md rows go stale — row NAMES are not cross-checked.
  - Counts inside fenced code blocks are not exempted; avoid literal "<N> skills" strings in code examples.
"""
import glob
import os
import re
import sys

SKILLS_DIR = ".claude/plugins/onebrain/skills"
EXCLUDED = {"_shared", "help", "startup"}
DOC_GLOBS = ["README.md", "docs/*.md"]
COUNT_RE = re.compile(r"(\d+)\+?\s+[Ss]kills\b")
TABLE_ROW_RE = re.compile(r"^\| `/")


def count_skills():
    n = 0
    for entry in sorted(os.listdir(SKILLS_DIR)):
        if entry in EXCLUDED:
            continue
        if os.path.isfile(os.path.join(SKILLS_DIR, entry, "SKILL.md")):
            n += 1
    return n


def doc_files():
    files = []
    for pattern in DOC_GLOBS:
        files.extend(sorted(glob.glob(pattern)))
    return files


def check_doc_counts(actual):
    errors = []
    for path in doc_files():
        with open(path, encoding="utf-8-sig") as fh:
            for lineno, line in enumerate(fh, start=1):
                for match in COUNT_RE.finditer(line):
                    stated = int(match.group(1))
                    if stated != actual:
                        errors.append(
                            f"{path}:{lineno}: says {stated}, actual {actual}"
                        )
    return errors


def check_skills_table(actual):
    path = "docs/skills.md"
    rows = 0
    with open(path, encoding="utf-8-sig") as fh:
        for line in fh:
            if TABLE_ROW_RE.match(line):
                rows += 1
    expected = actual + 1
    errors = []
    if rows != expected:
        errors.append(f"{path}: table has {rows} rows, expected {expected} (N+1 incl. /help)")
    return errors, rows


def main():
    actual = count_skills()
    errors = check_doc_counts(actual)

    table_errors, rows = check_skills_table(actual)
    errors.extend(table_errors)

    if errors:
        print("Skill count mismatches:")
        for e in errors:
            print(f"  ✗ {e}")
        sys.exit(1)

    print(f"Skill count OK — {actual} skills, docs consistent, table rows {rows}")


if __name__ == "__main__":
    main()

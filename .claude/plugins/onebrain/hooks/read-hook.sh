#!/usr/bin/env bash
# OneBrain plugin v3 — Vault-read Ledger Gate (PreToolUse hook, v3.4.10 Track 8).
#
# Gates repeat `Read` calls on vault `.md` files that were already delivered
# to this session's context unchanged — the token-optimization "already-sent
# ledger" (design doc §5b). First-time reads and reads of an edited doc
# always pass through untouched.
#
# Default posture: OFF and fail-open everywhere.
#   - `onebrain token check` itself answers "allow" immediately unless the
#     vault's onebrain.yml sets `token_optimization.read_hook: ledger`
#     (default: off) — no config parsing needed on the plugin side, the CLI
#     is the single source of truth for whether the gate is active.
#   - ONEBRAIN_HOOK_BYPASS=1 skips this hook entirely for the session.
#   - Any trouble at all (CLI missing/old, no `jq`, non-.md path, malformed
#     hook input, unexpected exit code, the 5s hook timeout below) fails
#     OPEN — the Read always proceeds. This hook only ever blocks on a
#     genuine repeat-send verdict from the CLI.
#
# Contract with `onebrain token check <path>` (CLI v3.4.10+):
#   exit 0 = allow (first send, or the doc's content changed since last
#            send) — nothing to do, let the Read proceed.
#   exit 2 = deny — stdout carries a reference envelope JSON (the doc was
#            already sent, unchanged, earlier this session). The envelope
#            always embeds a `rematerialize` instruction
#            (`onebrain search get <path> --force`) so the agent can pull
#            the full content back on purpose instead of retrying the Read.
#
# Translation to Claude Code's own PreToolUse protocol is a straight
# passthrough: exit 0 = allow, exit 2 with a reason on stderr = block the
# tool call and feed that reason back to Claude as context. The two
# protocols already line up, so no `hookSpecificOutput` JSON is needed.
#
# See INSTRUCTIONS.md → "Vault-read Ledger Gate (PreToolUse Hook)" for the
# user-facing explanation, the config key, and all three bypasses.

set -u

# Bypass 2 (see INSTRUCTIONS.md): explicit per-session opt-out, independent
# of onebrain.yml.
if [ "${ONEBRAIN_HOOK_BYPASS:-}" = "1" ]; then
  exit 0
fi

input=$(cat)

# `jq` is the only reliable way to unescape the JSON string correctly —
# this matters on Windows, where `tool_input.file_path` carries
# JSON-escaped backslashes (`C:\\Users\\...`) that a regex/sed extraction
# would pass through un-unescaped, corrupting the path. No jq -> fail open
# rather than hand-roll a lossy parse.
if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

tool_name=$(printf '%s' "$input" | jq -r '.tool_name // empty' 2>/dev/null)
if [ "${tool_name}" != "Read" ]; then
  exit 0
fi

file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
if [ -z "${file_path}" ]; then
  exit 0
fi

# Only gate markdown vault docs. A plain trailing-glob match is
# Windows-safe (backslash path separators don't affect a suffix match) and
# covers the common case variants without relying on bash 4+ case-folding
# (${var,,}) — macOS ships bash 3.2 by default.
case "${file_path}" in
  *.md | *.MD | *.Md | *.mD) ;;
  *) exit 0 ;;
esac

if ! command -v onebrain >/dev/null 2>&1; then
  exit 0
fi

envelope=$(onebrain token check "${file_path}" 2>/dev/null)
status=$?

if [ "${status}" -eq 2 ] && [ -n "${envelope}" ]; then
  # Deny: surface the reference envelope to Claude as the block reason.
  printf '%s\n' "${envelope}" >&2
  exit 2
fi

# status 0 (allow), or any unexpected status — fail open.
exit 0

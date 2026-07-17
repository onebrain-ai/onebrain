#!/usr/bin/env bash
# OneBrain plugin v3 — Search Cascade Grep Gate (PreToolUse hook, Track C #221).
#
# Enforces the search cascade documented in
# skills/startup/SEARCH.md: vault CONTENT search must go through
# `mcp__plugin_onebrain_search__query` first. Grep is only the legitimate
# fallback after a genuine MCP miss (unavailable/error, zero or all-low-
# confidence hits, or a freshness gap). This hook gates a Grep call that
# looks like a content search sweeping the vault's markdown folders WITHOUT
# that escape hatch — it does not gate structural greps (task-line scans,
# frontmatter anchors, wikilink scans, date/checkpoint filename patterns,
# exact code identifiers) or anything outside the vault's content folders.
#
# Default posture: fail-open everywhere, mirroring hooks/read-hook.sh's
# harmlessness contract (read that file first if editing this one).
#   - ONEBRAIN_HOOK_BYPASS=1 skips this hook entirely for the session.
#   - Any trouble at all (missing jq, unreadable/unresolvable config,
#     malformed hook input, an empty pattern, non-Grep tool calls, the
#     5s hook timeout) fails OPEN — the Grep call proceeds untouched.
#   - This hook NEVER blocks a Grep outside 00-inbox/01-projects/02-areas/
#     03-knowledge/04-resources (or the vault's configured equivalents),
#     never blocks a non-.md target, and never blocks a structural pattern.
#
# Escape hatch: a pattern containing the sentinel substring `mcp-miss`
# (added by the agent, per SEARCH.md step 3, only after a genuine MCP miss)
# always allows through — this is how the agent legitimately falls back to
# Grep without tripping the gate on every retry.
#
# Verdict output: on a genuine block (exit 2), the one-line reason is
# written to BOTH stdout and stderr — stdout per this hook's own contract,
# stderr because that's what Claude Code's PreToolUse protocol actually
# feeds back to the agent as block context (see read-hook.sh's header for
# the same protocol note). The reason is agent-facing only; it is never
# shown to the user.
#
# See INSTRUCTIONS.md "Search Strategy" and skills/startup/SEARCH.md "The
# Cascade" for the full contract this hook enforces.

set -u

# Bypass: explicit per-session opt-out, independent of onebrain.yml.
if [ "${ONEBRAIN_HOOK_BYPASS:-}" = "1" ]; then
  exit 0
fi

input=$(cat)

# jq is the only reliable way to parse the hook JSON without a lossy
# hand-rolled extraction. No jq -> fail open.
if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

tool_name=$(printf '%s' "${input}" | jq -r '.tool_name // empty' 2>/dev/null)
if [ "${tool_name}" != "Grep" ]; then
  exit 0
fi

pattern=$(printf '%s' "${input}" | jq -r '.tool_input.pattern // empty' 2>/dev/null)
if [ -z "${pattern}" ]; then
  # Malformed / no pattern to judge — fail open.
  exit 0
fi

target_path=$(printf '%s' "${input}" | jq -r '.tool_input.path // empty' 2>/dev/null)
target_glob=$(printf '%s' "${input}" | jq -r '.tool_input.glob // empty' 2>/dev/null)
target_type=$(printf '%s' "${input}" | jq -r '.tool_input.type // empty' 2>/dev/null)

# ---------------------------------------------------------------------------
# Structural allowlist — always allowed, regardless of path/target. These are
# the query shapes SEARCH.md's decision table already carves out as non-
# content lookups (task-line scans, frontmatter anchors, wikilink scans,
# date/checkpoint filenames, exact code identifiers), plus the mcp-miss
# escape hatch itself.
# ---------------------------------------------------------------------------

_gg_lc() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

pattern_lc=$(_gg_lc "${pattern}")

# mcp-miss sentinel: the agent's documented fallback marker.
case "${pattern_lc}" in
  *mcp-miss*) exit 0 ;;
esac

# Task-line patterns: - [ ], - [x], [ ], [x], and escaped-bracket variants.
case "${pattern}" in
  *'- \[ \]'* | *'- \[x\]'* | *'- \[X\]'* | *'\[ \]'* | *'\[x\]'* | *'\[X\]'* | *'- [ ]'* | *'- [x]'* | *'- [X]'*)
    exit 0
    ;;
esac

# Frontmatter anchors: ^---, ^tags:, or a generic ^<word>: frontmatter key.
case "${pattern}" in
  '^---'*) exit 0 ;;
  '^tags:'*) exit 0 ;;
esac
if printf '%s' "${pattern}" | grep -Eq '^\^[A-Za-z_][A-Za-z0-9_-]*:'; then
  exit 0
fi

# Wikilink scans: contains [[.
case "${pattern}" in
  *'[['*) exit 0 ;;
esac

# Date / checkpoint filename patterns: YYYY-MM-DD-style digit-group regexes,
# or the literal word "checkpoint".
if printf '%s' "${pattern}" | grep -Eq '[0-9]\{4\}.*[0-9]\{2\}.*[0-9]\{2\}|[0-9]{4}.*[0-9]{2}.*[0-9]{2}'; then
  exit 0
fi
case "${pattern_lc}" in
  *checkpoint*) exit 0 ;;
esac

# Exact code identifiers (heuristic): contains "::" or "_(" (namespaced /
# function-call-shaped), or is a single space-free ALL_CAPS / snake_case
# token with no other regex/prose structure.
case "${pattern}" in
  *'::'* | *'_('*) exit 0 ;;
esac
if printf '%s' "${pattern}" | grep -Eq '^[A-Za-z_][A-Za-z0-9_]*$'; then
  # No spaces, identifier-shaped. Treat as a code-search token unless it's
  # a single common English word with no underscore/caps signal — those are
  # ambiguous, so only allowlist when it carries an underscore or is
  # ALL_CAPS/camelCase-ish (has a case transition or underscore).
  if printf '%s' "${pattern}" | grep -Eq '_|[A-Z]'; then
    exit 0
  fi
fi

# ---------------------------------------------------------------------------
# Resolve vault content folders from onebrain.yml (walk up from the target
# path if given, else from $PWD), falling back to the documented defaults.
# This is a best-effort default-value resolution, not a fail-open trigger —
# an unreadable/missing config just means "use the defaults".
# ---------------------------------------------------------------------------

_gg_dir="${target_path:-$PWD}"
case "${_gg_dir}" in
  /*) ;;
  *) _gg_dir="${PWD}/${_gg_dir}" ;;
esac
[ -d "${_gg_dir}" ] || _gg_dir=$(dirname "${_gg_dir}")

_gg_cfg=""
_gg_walk="${_gg_dir}"
while [ -n "${_gg_walk}" ] && [ "${_gg_walk}" != "/" ] && [ "${_gg_walk}" != "." ]; do
  if [ -f "${_gg_walk}/onebrain.yml" ]; then _gg_cfg="${_gg_walk}/onebrain.yml"; break; fi
  if [ -f "${_gg_walk}/vault.yml" ]; then _gg_cfg="${_gg_walk}/vault.yml"; break; fi
  _gg_walk=$(dirname "${_gg_walk}")
done

f_inbox="00-inbox"
f_projects="01-projects"
f_areas="02-areas"
f_knowledge="03-knowledge"
f_resources="04-resources"

if [ -n "${_gg_cfg}" ] && [ -r "${_gg_cfg}" ]; then
  _v=$(grep -E '^[[:space:]]+inbox:' "${_gg_cfg}" 2>/dev/null | head -1 | sed -E 's/^[[:space:]]+inbox:[[:space:]]*//' | tr -d '"'"'"'\r')
  [ -n "${_v}" ] && f_inbox="${_v}"
  _v=$(grep -E '^[[:space:]]+projects:' "${_gg_cfg}" 2>/dev/null | head -1 | sed -E 's/^[[:space:]]+projects:[[:space:]]*//' | tr -d '"'"'"'\r')
  [ -n "${_v}" ] && f_projects="${_v}"
  _v=$(grep -E '^[[:space:]]+areas:' "${_gg_cfg}" 2>/dev/null | head -1 | sed -E 's/^[[:space:]]+areas:[[:space:]]*//' | tr -d '"'"'"'\r')
  [ -n "${_v}" ] && f_areas="${_v}"
  _v=$(grep -E '^[[:space:]]+knowledge:' "${_gg_cfg}" 2>/dev/null | head -1 | sed -E 's/^[[:space:]]+knowledge:[[:space:]]*//' | tr -d '"'"'"'\r')
  [ -n "${_v}" ] && f_knowledge="${_v}"
  _v=$(grep -E '^[[:space:]]+resources:' "${_gg_cfg}" 2>/dev/null | head -1 | sed -E 's/^[[:space:]]+resources:[[:space:]]*//' | tr -d '"'"'"'\r')
  [ -n "${_v}" ] && f_resources="${_v}"
fi

_gg_vault_root="${PWD}"
[ -n "${_gg_cfg}" ] && _gg_vault_root=$(dirname "${_gg_cfg}")

# ---------------------------------------------------------------------------
# Does the target path resolve inside a vault content folder?
# ---------------------------------------------------------------------------

_gg_in_content_folder() {
  candidate="$1"
  for f in "${f_inbox}" "${f_projects}" "${f_areas}" "${f_knowledge}" "${f_resources}"; do
    case "${candidate}" in
      "${f}" | "${f}"/*) return 0 ;;
    esac
    case "${candidate}" in
      "${_gg_vault_root}/${f}" | "${_gg_vault_root}/${f}"/*) return 0 ;;
    esac
  done
  return 1
}

in_vault_content=1
if [ -z "${target_path}" ]; then
  # No path given: Grep defaults to sweeping cwd. Only "counts" if at least
  # one content folder actually exists under the vault root — otherwise
  # there's nothing vault-shaped to sweep, so don't gate.
  found_any=0
  for f in "${f_inbox}" "${f_projects}" "${f_areas}" "${f_knowledge}" "${f_resources}"; do
    if [ -d "${_gg_vault_root}/${f}" ]; then
      found_any=1
      break
    fi
  done
  [ "${found_any}" -eq 1 ] || in_vault_content=0
else
  _gg_norm="${target_path}"
  case "${_gg_norm}" in
    ./*) _gg_norm="${_gg_norm#./}" ;;
  esac
  if ! _gg_in_content_folder "${_gg_norm}"; then
    in_vault_content=0
  fi
fi

if [ "${in_vault_content}" -eq 0 ]; then
  exit 0
fi

# ---------------------------------------------------------------------------
# Does the target look like it's searching .md content?
# ---------------------------------------------------------------------------

targets_md=1
if [ -n "${target_glob}" ]; then
  case "$(_gg_lc "${target_glob}")" in
    *md* | '*' | '**' | '**/*') targets_md=1 ;;
    *) targets_md=0 ;;
  esac
fi
if [ -n "${target_type}" ]; then
  case "$(_gg_lc "${target_type}")" in
    md | markdown) targets_md=1 ;;
    *) targets_md=0 ;;
  esac
fi

if [ "${targets_md}" -eq 0 ]; then
  exit 0
fi

# ---------------------------------------------------------------------------
# All gate conditions met: block, with an agent-facing reason.
# ---------------------------------------------------------------------------

reason="vault content search must go through mcp__plugin_onebrain_search__query first; grep is the fallback after an MCP miss (add a '# mcp-miss' sentinel to the pattern when falling back legitimately)"

printf '%s\n' "${reason}"
printf '%s\n' "${reason}" >&2
exit 2

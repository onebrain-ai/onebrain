#!/usr/bin/env bash
# OneBrain plugin v3 — SessionStart enforcement hook.
#
# Refuses to load the session when the `onebrain` CLI is absent or older
# than v3.0.0 (the Rust rewrite GA). Pairs with `requires.cli` in
# plugin.json — that field is metadata for tooling; this hook is the
# runtime enforcement.
#
# Comparison strategy: extract the bare MAJOR.MINOR.PATCH from
# `onebrain --version` (drops any prerelease suffix like -alpha.9) and
# sort against 3.0.0 with `sort -V`. This means v3.0.0-alpha.x users
# (who already run the new Rust binary) pass; v2.x Bun users are blocked
# with a clear update path.
#
# Output contract: emit a JSON SessionStart payload with `decision: block`
# and a `reason` that lists the install / update paths for each platform.
# Exit 0 either way — the JSON `decision` is what Claude Code reads.

set -u

MIN_VERSION="3.0.0"

block_message() {
  # Single-string JSON message; embedded newlines stay as literal "\n" in
  # the JSON since heredoc-via-printf would re-evaluate them otherwise.
  local reason="$1"
  cat <<JSON
{
  "decision": "block",
  "reason": "${reason}"
}
JSON
}

if ! command -v onebrain >/dev/null 2>&1; then
  block_message "OneBrain plugin v3.x requires the \`onebrain\` CLI (>= ${MIN_VERSION}) on PATH, but it was not found.\n\nInstall:\n  • macOS:   brew tap onebrain-ai/onebrain && brew install onebrain\n  • Linux:   download a binary from https://github.com/onebrain-ai/onebrain-cli/releases/latest\n  • Windows: download a binary from https://github.com/onebrain-ai/onebrain-cli/releases/latest\n\nThen restart this session."
  exit 0
fi

# Extract the bare semver triple from `onebrain --version` output
# (handles `onebrain 3.0.0`, `onebrain 3.0.0-alpha.9`, or any leading text).
CURRENT_VERSION=$(onebrain --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)

if [ -z "${CURRENT_VERSION}" ]; then
  block_message "OneBrain plugin v3.x could not parse the \`onebrain --version\` output. Verify the CLI is on PATH and at least v${MIN_VERSION} — run \`onebrain --version\` manually to debug."
  exit 0
fi

# Lowest of (current, MIN). If MIN sorts lowest, current >= MIN → pass.
LOWEST=$(printf '%s\n%s\n' "${CURRENT_VERSION}" "${MIN_VERSION}" | sort -V | head -1)

if [ "${LOWEST}" != "${MIN_VERSION}" ]; then
  block_message "OneBrain plugin v3.x requires CLI >= ${MIN_VERSION}, but found v${CURRENT_VERSION}.\n\nUpdate in place:\n  onebrain update\n\nOr reinstall:\n  • macOS:   brew tap onebrain-ai/onebrain && brew upgrade onebrain (or brew install onebrain-ai/onebrain/onebrain)\n  • Linux/Windows: download from https://github.com/onebrain-ai/onebrain-cli/releases/latest\n\nThen restart this session."
  exit 0
fi

# CLI is compatible — pass silently.
exit 0

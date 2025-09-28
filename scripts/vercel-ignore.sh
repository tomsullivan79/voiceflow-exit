#!/usr/bin/env bash
set -euo pipefail

MSG="${VERCEL_GIT_COMMIT_MESSAGE:-}"
SHA="${VERCEL_GIT_COMMIT_SHA:-}"

# 1) If the message is the snapshot bot commit → skip
if echo "$MSG" | grep -qi "Auto-update Assistant Snapshot"; then
  echo "skip: snapshot auto-commit (message match)"
  exit 0
fi

# 2) If this commit only changed the snapshot file → skip
# (The build environment has a Git checkout, so this works.)
if CHANGED=$(git diff-tree --no-commit-id --name-only -r "$SHA" 2>/dev/null); then
  if [ "$(echo "$CHANGED" | wc -w | tr -d ' ')" = "1" ] && [ "$CHANGED" = "ASSISTANT_SNAPSHOT.md" ]; then
    echo "skip: snapshot auto-commit (only ASSISTANT_SNAPSHOT.md changed)"
    exit 0
  fi
fi

# Otherwise: do NOT print anything → Vercel will proceed with the build
exit 1

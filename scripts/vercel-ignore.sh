#!/usr/bin/env bash
set -euo pipefail

MSG="${VERCEL_GIT_COMMIT_MESSAGE:-}"

if echo "$MSG" | grep -qi "Auto-update Assistant Snapshot"; then
  echo "skip: snapshot auto-commit"
  exit 0  # print anything -> Vercel skips the build
fi

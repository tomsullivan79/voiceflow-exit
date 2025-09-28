#!/usr/bin/env bash
set -euo pipefail

MSG="${VERCEL_GIT_COMMIT_MESSAGE:-}"
SHA="${VERCEL_GIT_COMMIT_SHA:-}"

# A) Respect common skip tokens in commit message
if echo "$MSG" | grep -qiE '\[skip ci\]|\[ci skip\]'; then
  echo "skip: commit message has [skip ci]/[ci skip]"
  exit 0
fi

# B) Skip known bot commits by subject
if echo "$MSG" | grep -qi "Auto-update Assistant Snapshot"; then
  echo "skip: snapshot auto-commit (subject match)"
  exit 0
fi
if echo "$MSG" | grep -qi "Auto-generate db/SCHEMA.md"; then
  echo "skip: schema auto-commit (subject match)"
  exit 0
fi

# C) Skip commits that changed only known doc files
if CHANGED=$(git diff-tree --no-commit-id --name-only -r "$SHA" 2>/dev/null); then
  # normalize to single-line space-separated list
  LIST=$(echo "$CHANGED" | tr '\n' ' ' | xargs)
  # only ASSISTANT_SNAPSHOT.md
  if [ "$LIST" = "ASSISTANT_SNAPSHOT.md" ]; then
    echo "skip: only ASSISTANT_SNAPSHOT.md changed"
    exit 0
  fi
  # only db/SCHEMA.md
  if [ "$LIST" = "db/SCHEMA.md" ]; then
    echo "skip: only db/SCHEMA.md changed"
    exit 0
  fi
fi

# Otherwise: build proceeds (print nothing and exit non-zero)
exit 1

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOY_ROOT="${DEPLOY_ROOT:-$REPO_ROOT/infra/runtime}"
CURRENT_LINK="$DEPLOY_ROOT/current"
TARGET_RELEASE="${1:-}"

if [ -z "$TARGET_RELEASE" ]; then
  echo "Usage: rollback-api.sh /path/to/previous/release"
  exit 1
fi

if [ ! -d "$TARGET_RELEASE" ]; then
  echo "Release directory not found: $TARGET_RELEASE"
  exit 1
fi

ln -sfn "$TARGET_RELEASE" "$CURRENT_LINK"
echo "Rolled back current release to $TARGET_RELEASE"

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVICE_DIR="$REPO_ROOT/services/api"
DEPLOY_ROOT="${DEPLOY_ROOT:-$REPO_ROOT/infra/runtime}"
RELEASE_ROOT="$DEPLOY_ROOT/releases"
CURRENT_LINK="$DEPLOY_ROOT/current"
SERVICE_NAME="${PM2_SERVICE_NAME:-k-game-api}"
PORT="${PORT:-4000}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:${PORT}/api/health}"

if [ ! -d "$SERVICE_DIR" ]; then
  echo "Service directory not found: $SERVICE_DIR"
  exit 1
fi

if [ ! -f "$SERVICE_DIR/.env" ]; then
  echo "services/api/.env not found. Materialize it from Secrets Manager or SSM before deployment."
  exit 1
fi

mkdir -p "$RELEASE_ROOT"

TIMESTAMP="$(date +%Y%m%d%H%M%S)"
NEW_RELEASE_DIR="$RELEASE_ROOT/$TIMESTAMP"
NEW_SERVICE_DIR="$NEW_RELEASE_DIR/api"
PREVIOUS_TARGET=""

if [ -L "$CURRENT_LINK" ]; then
  PREVIOUS_TARGET="$(readlink -f "$CURRENT_LINK" || true)"
fi

copy_release() {
  mkdir -p "$NEW_SERVICE_DIR"
  cp -a "$SERVICE_DIR/." "$NEW_SERVICE_DIR/"
}

start_pm2_release() {
  local target_dir="$1"
  pm2 delete "$SERVICE_NAME" >/dev/null 2>&1 || true
  pm2 start "$target_dir/server.js" --name "$SERVICE_NAME" --cwd "$target_dir"
  pm2 save
}

wait_for_healthcheck() {
  local attempt
  for attempt in $(seq 1 20); do
    if curl --fail --silent --show-error "$HEALTHCHECK_URL" >/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

rollback() {
  if [ -z "$PREVIOUS_TARGET" ] || [ ! -d "$PREVIOUS_TARGET" ]; then
    echo "Rollback failed: previous release not found."
    return 1
  fi

  echo "Health check failed. Rolling back to $PREVIOUS_TARGET"
  ln -sfn "$PREVIOUS_TARGET" "$CURRENT_LINK"
  start_pm2_release "$CURRENT_LINK"
}

copy_release
cd "$NEW_SERVICE_DIR"

if ! npm ci; then
  npm install
fi

npm run check
npm run migrate

ln -sfn "$NEW_SERVICE_DIR" "$CURRENT_LINK"
start_pm2_release "$CURRENT_LINK"

if ! wait_for_healthcheck; then
  rollback
  exit 1
fi

echo "Server deployed successfully from $NEW_SERVICE_DIR"

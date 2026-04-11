#!/usr/bin/env bash
set -euo pipefail

HEALTHCHECK_URL="${HEALTHCHECK_URL:-http://127.0.0.1:4000/api/health}"

if curl --fail --silent --show-error "$HEALTHCHECK_URL" >/dev/null; then
  echo "Health check passed: $HEALTHCHECK_URL"
else
  echo "Health check failed: $HEALTHCHECK_URL"
  exit 1
fi

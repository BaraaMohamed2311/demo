#!/usr/bin/env bash
set -uo pipefail
NEW="${1:?usage: deploy.sh <image-tag>}"
STATE="${DEPLOY_STATE:-$HOME/.deployed_tag}"   # outside the workspace, so checkout can't wipe it
PREV=$(cat "$STATE" 2>/dev/null || true)

up()      { IMAGE_TAG="$1" docker compose pull api && IMAGE_TAG="$1" docker compose up -d; }
healthy() { for i in $(seq 1 30); do curl -fsS http://localhost:3000/readyz >/dev/null && return 0; sleep 2; done; return 1; }

up "$NEW"
if healthy; then echo "$NEW" > "$STATE"; echo "Deployed $NEW"; exit 0; fi

echo "::error::$NEW unhealthy"; docker compose logs --tail=50 api
if [ -n "$PREV" ]; then
  echo "Rolling back to $PREV"
  up "$PREV" && healthy && echo "Rolled back to $PREV"
fi
exit 1
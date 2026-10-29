#!/usr/bin/env bash
set -uo pipefail

# Usage: ./deploy.sh <image-tag>
NEW="${1:?usage: deploy.sh <image-tag>}"

COMPOSE_FILE="docker-compose.remote.yml"            # matches what ci.yml already uses
STATE="${DEPLOY_STATE:-$HOME/.deployed_tag}"        # stored outside the repo checkout, so it survives between runs
PREV=$(cat "$STATE" 2>/dev/null || true)
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"         # GitHub Actions renders this file in the job UI, outside the raw log

up() {
  IMAGE_TAG="$1" docker compose -f "$COMPOSE_FILE" pull api
  IMAGE_TAG="$1" docker compose -f "$COMPOSE_FILE" up -d
}

healthy() {
  for i in $(seq 1 30); do
    curl -fsS http://localhost:3000/readyz >/dev/null && return 0
    sleep 2
  done
  return 1
}

# Shows which image tag the api container is actually running right now,
# straight from docker, not from a file this script wrote itself.
running_tag() {
  docker inspect --format '{{.Config.Image}}' "$(docker compose -f "$COMPOSE_FILE" ps -q api)" 2>/dev/null
}

echo "=== Deploying $NEW (previous recorded tag: ${PREV:-none}) ==="
up "$NEW"

if healthy; then
  echo "$NEW" > "$STATE"
  echo "=== Deploy succeeded: $NEW is healthy ==="
  echo "Running image: $(running_tag)"

  {
    echo "## Deploy result: SUCCESS"
    echo "- Deployed tag: \`$NEW\`"
    echo "- Running image (from \`docker inspect\`): \`$(running_tag)\`"
    echo "- Health check: \`/readyz\` returned 200"
  } >> "$SUMMARY"

  exit 0
fi

echo "=== $NEW FAILED health check, last 50 log lines from the failing container: ==="
docker compose -f "$COMPOSE_FILE" logs --tail=50 api

{
  echo "## Deploy result: NEW VERSION FAILED"
  echo "- Attempted tag: \`$NEW\`"
  echo "- \`/readyz\` did not return 200 within 60s"
} >> "$SUMMARY"

if [ -n "$PREV" ] && [ "$PREV" != "$NEW" ]; then
  echo "=== Rolling back to $PREV ==="
  up "$PREV"
  if healthy; then
    echo "=== Rollback succeeded: $PREV is healthy again ==="
    echo "Running image: $(running_tag)"
    {
      echo "## Rollback result: SUCCESS"
      echo "- Rolled back to: \`$PREV\`"
      echo "- Running image (from \`docker inspect\`): \`$(running_tag)\`"
      echo "- Health check: \`/readyz\` returned 200"
    } >> "$SUMMARY"
  else
    echo "=== Rollback to $PREV ALSO FAILED health check ==="
    {
      echo "## Rollback result: FAILED — manual intervention needed"
    } >> "$SUMMARY"
  fi
else
  echo "=== No previous known-good tag recorded, cannot roll back automatically ==="
  {
    echo "## Rollback result: SKIPPED — no previous tag recorded"
  } >> "$SUMMARY"
fi

exit 1
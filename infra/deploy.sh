#!/bin/sh
set -eu

image_tag=${1:?Usage: deploy.sh IMAGE_TAG}
ghcr_owner=${2:?Usage: deploy.sh IMAGE_TAG GHCR_OWNER}
compose_file=/opt/nexova/infra/compose.production.yml
env_file=/opt/nexova/infra/.env.production

if [ ! -f "$compose_file" ] || [ ! -f "$env_file" ]; then
    echo "Deployment files are missing from /opt/nexova/infra." >&2
    exit 1
fi

export IMAGE_TAG="$image_tag"
export GHCR_OWNER="$ghcr_owner"

if ! IFS= read -r registry_token; then
    echo "A temporary GHCR token must be provided on stdin." >&2
    exit 1
fi

if [ -z "$registry_token" ]; then
    echo "A temporary GHCR token must be provided on stdin." >&2
    exit 1
fi

cleanup() {
    docker logout ghcr.io >/dev/null 2>&1 || true
}

trap cleanup EXIT
printf '%s' "$registry_token" | docker login ghcr.io --username "$ghcr_owner" --password-stdin
unset registry_token

docker compose --env-file "$env_file" -f "$compose_file" pull
docker compose --env-file "$env_file" -f "$compose_file" up \
    --detach \
    --no-build \
    --remove-orphans \
    --wait \
    --wait-timeout 120
docker compose --env-file "$env_file" -f "$compose_file" ps
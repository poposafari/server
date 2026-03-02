#!/usr/bin/env bash
# 프로젝트 루트에서 실행. deploy.sh 와 동일하되 docker-compose.profile.yml 로
# api/socket/worker 에 --cpu-prof, --trace-gc 적용. 1타 3피용.
# 사용: ./deploy-profile.sh              → 전체 up -d --build (프로파일 모드)
#       ./deploy-profile.sh down        → 전체 down
#       ./deploy-profile.sh api socket  → api, socket 만 프로파일 모드로

set -e

COMPOSE_FILE="docker/prod/docker-compose.yml"
PROFILE_FILE="docker/prod/docker-compose.profile.yml"
ENV_FILE="docker/prod/.env.prod"

VALID_SERVICES="api socket worker nginx postgres redis"

usage() {
  echo "Usage: $0 [down | SERVICE...]"
  echo "  down       : stop and remove all services"
  echo "  No args    : rebuild and start all (with --cpu-prof --trace-gc)"
  echo "  SERVICE... : rebuild and start only listed services"
  echo "  Valid: $VALID_SERVICES"
  exit 1
}

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Error: Run from project root (expected $COMPOSE_FILE)"
  exit 1
fi

if [[ ! -f "$PROFILE_FILE" ]]; then
  echo "Error: $PROFILE_FILE not found"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

if [[ $# -ge 1 && "$1" == "down" ]]; then
  echo "Stopping and removing all services..."
  docker compose -f "$COMPOSE_FILE" -f "$PROFILE_FILE" --env-file "$ENV_FILE" down
  exit 0
fi

for s in "$@"; do
  if [[ ! " $VALID_SERVICES " =~ " $s " ]]; then
    echo "Error: Invalid service '$s'. Valid: $VALID_SERVICES"
    usage
  fi
done

echo "Profile mode: --cpu-prof --trace-gc. Output: container /app (docker cp to retrieve)."
if [[ $# -eq 0 ]]; then
  echo "Rebuilding and starting all services..."
  docker compose -f "$COMPOSE_FILE" -f "$PROFILE_FILE" --env-file "$ENV_FILE" up -d --build
else
  echo "Rebuilding and starting: $*"
  docker compose -f "$COMPOSE_FILE" -f "$PROFILE_FILE" --env-file "$ENV_FILE" up -d --build "$@"
fi

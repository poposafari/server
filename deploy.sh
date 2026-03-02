#!/usr/bin/env bash
# 프로젝트 루트에서 실행. docker/prod 기준 전체 또는 지정 서비스만 재빌드·재기동.
# 사용: ./deploy.sh              → 전체 up -d --build
#       ./deploy.sh down         → 전체 down
#       ./deploy.sh api          → api만 재빌드·재기동
#       ./deploy.sh socket nginx → socket, nginx만
# 프로파일링: ./deploy-profile.sh (별도 스크립트)

set -e

COMPOSE_FILE="docker/prod/docker-compose.yml"
ENV_FILE="docker/prod/.env.prod"

VALID_SERVICES="api socket worker nginx postgres redis"

usage() {
  echo "Usage: $0 [down | SERVICE...]"
  echo "  down       : stop and remove all services"
  echo "  No args    : rebuild and start all services"
  echo "  SERVICE... : rebuild and start only listed services (e.g. api socket nginx)"
  echo "  Valid: $VALID_SERVICES"
  exit 1
}

# 프로젝트 루트에서 실행되는지 확인 (docker/prod/docker-compose.yml 존재)
if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Error: Run from project root (expected $COMPOSE_FILE)"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

if [[ $# -ge 1 && "$1" == "down" ]]; then
  echo "Stopping and removing all services..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
  exit 0
fi

for s in "$@"; do
  if [[ ! " $VALID_SERVICES " =~ " $s " ]]; then
    echo "Error: Invalid service '$s'. Valid: $VALID_SERVICES"
    usage
  fi
done

if [[ $# -eq 0 ]]; then
  echo "Rebuilding and starting all services..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build
else
  echo "Rebuilding and starting: $*"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build "$@"
fi

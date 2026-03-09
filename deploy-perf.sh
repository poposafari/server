#!/usr/bin/env bash
# 프로젝트 루트에서 실행. deploy.sh 와 동일하되 docker-compose.perf.yml 로
# socket 서버에 --perf-basic-prof 적용 + perf 실행에 필요한 권한 부여.
#
# 사용: ./deploy-perf.sh              → 전체 up -d --build (perf 모드)
#       ./deploy-perf.sh down         → 전체 down
#       ./deploy-perf.sh socket nginx → socket, nginx만 perf 모드로
#
# perf 사용법은 docs/perf-guide.md 참고.

set -e

COMPOSE_FILE="docker/prod/docker-compose.yml"
PERF_FILE="docker/prod/docker-compose.perf.yml"
ENV_FILE="docker/prod/.env.prod"

VALID_SERVICES="api socket worker nginx postgres redis"

usage() {
  echo "Usage: $0 [down | SERVICE...]"
  echo "  down       : stop and remove all services"
  echo "  No args    : rebuild and start all (socket with --perf-basic-prof)"
  echo "  SERVICE... : rebuild and start only listed services"
  echo "  Valid: $VALID_SERVICES"
  exit 1
}

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Error: Run from project root (expected $COMPOSE_FILE)"
  exit 1
fi

if [[ ! -f "$PERF_FILE" ]]; then
  echo "Error: $PERF_FILE not found"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

if [[ $# -ge 1 && "$1" == "down" ]]; then
  echo "Stopping and removing all services..."
  docker compose -f "$COMPOSE_FILE" -f "$PERF_FILE" --env-file "$ENV_FILE" down
  exit 0
fi

for s in "$@"; do
  if [[ ! " $VALID_SERVICES " =~ " $s " ]]; then
    echo "Error: Invalid service '$s'. Valid: $VALID_SERVICES"
    usage
  fi
done

echo "Perf mode: socket uses Debian image (glibc) with --perf-basic-prof + SYS_ADMIN."
echo "See docs/perf-guide.md for how to capture and analyze results."
if [[ $# -eq 0 ]]; then
  echo "Rebuilding and starting all services..."
  docker compose -f "$COMPOSE_FILE" -f "$PERF_FILE" --env-file "$ENV_FILE" up -d --build
else
  echo "Rebuilding and starting: $*"
  docker compose -f "$COMPOSE_FILE" -f "$PERF_FILE" --env-file "$ENV_FILE" up -d --build "$@"
fi

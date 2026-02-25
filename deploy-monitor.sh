#!/usr/bin/env bash
# 프로젝트 루트에서 실행. cAdvisor + Prometheus + Grafana 모니터 스택 배포.
# 사용: ./deploy-monitor.sh       → 모니터 스택 up -d
#       ./deploy-monitor.sh down  → 모니터 스택 down
# Grafana 비밀번호: GRAFANA_ADMIN_PASSWORD=원하는비밀번호 ./deploy-monitor.sh

set -e

COMPOSE_FILE="docker/prod/docker-compose.monitor.yml"

usage() {
  echo "Usage: $0 [down]"
  echo "  (no args) : start monitor stack (cAdvisor, Prometheus, Grafana)"
  echo "  down      : stop and remove monitor stack"
  exit 1
}

if [[ $# -gt 1 ]] || [[ $# -eq 1 && "$1" != "down" ]]; then
  usage
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Error: Run from project root (expected $COMPOSE_FILE)"
  exit 1
fi

if [[ $# -eq 1 && "$1" == "down" ]]; then
  echo "Stopping and removing monitor stack..."
  docker compose -f "$COMPOSE_FILE" down
  exit 0
fi

echo "Starting monitor stack..."
docker compose -f "$COMPOSE_FILE" up -d

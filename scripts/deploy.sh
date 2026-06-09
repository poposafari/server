#!/usr/bin/env bash
set -euo pipefail
IMAGE_TAG=${1:-latest}
COMPOSE="docker compose -f docker/prod/docker-compose.yml --env-file docker/prod/.env.prod"

# .env.prod에서 INTERNAL_TOKEN 추출 (broadcast 인증용). 없으면 빈 값 → 0.5 단계 skip.
INTERNAL_TOKEN=$(grep -E '^INTERNAL_TOKEN=' docker/prod/.env.prod 2>/dev/null | head -1 | cut -d'=' -f2- || true)

# 0) 직전 SHA 백업 (롤백용)
if [ -f ~/.poposafari-current-sha ]; then
  cp ~/.poposafari-current-sha ~/.poposafari-previous-sha
fi

# 0.5) 활성 socket에 점검 시작 broadcast (kicked reason='MAINTENANCE')
# - Nginx flag ON 직전에 호출 → 클라이언트가 좀비 상태 없이 즉시 MaintenancePhase로 전환
# - INTERNAL_TOKEN 미설정 시 skip (호환성). prod에선 .env.prod에 반드시 셋팅 권장
# - api 컨테이너는 호스트에 publish 안 됨 → docker exec로 컨테이너 내부 localhost 호출
if [ -n "$INTERNAL_TOKEN" ]; then
  echo "[0.5/8] broadcasting maintenance to active sockets"
  docker exec poposerver_api wget -qO- \
    --header="X-Internal-Token: ${INTERNAL_TOKEN}" \
    --post-data="" \
    http://127.0.0.1:9000/api/__internal/maintenance/broadcast || \
    echo "  WARN: broadcast failed (계속 진행)"
  sleep 3   # 클라이언트들이 MaintenancePhase로 전환할 시간 확보
else
  echo "[0.5/8] INTERNAL_TOKEN missing — skipping broadcast"
fi

echo "[1/8] maintenance flag ON"

mkdir -p docker/prod/flags
touch docker/prod/flags/maintenance

echo "[2/8] image pull (tag=$IMAGE_TAG)"
IMAGE_TAG=$IMAGE_TAG $COMPOSE pull api socket worker flush

echo "[3/8] recreate app containers (PG/Redis 유지)"
IMAGE_TAG=$IMAGE_TAG $COMPOSE up -d --no-deps api socket worker flush

echo "[4/8] drizzle migrate — skipped (manual schema management)"

echo "[5/8] healthcheck (60s 폴링)"

for i in $(seq 1 60); do
  STATUS=$(docker inspect -f '{{.State.Status}}' poposerver_api 2>/dev/null || echo "missing")
  RESTARTS=$(docker inspect -f '{{.RestartCount}}' poposerver_api 2>/dev/null || echo "?")

  if [ "$STATUS" = "restarting" ] || [ "$STATUS" = "exited" ]; then
    echo "FAIL: api container status=$STATUS restarts=$RESTARTS (attempt $i)"
    echo "----- docker logs poposerver_api (tail 150) -----"
    docker logs poposerver_api --tail 150 2>&1 || true
    exit 1
  fi

  if docker exec poposerver_api wget -qO- http://127.0.0.1:9000/health >/dev/null 2>&1; then
    echo "  healthy at attempt $i"; break
  fi
  sleep 1

  if [ "$i" -eq 60 ]; then
    echo "FAIL: healthcheck timeout"
    echo "----- docker logs poposerver_api (tail 150) -----"
    docker logs poposerver_api --tail 150 2>&1 || true
    exit 1
  fi
done

echo "[6/8] maintenance flag OFF"
rm -f docker/prod/flags/maintenance

echo "[7/8] save deployed SHA"
echo "$IMAGE_TAG" > ~/.poposafari-current-sha

echo "[8/8] done — $IMAGE_TAG"
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
    http://localhost:9000/api/__internal/maintenance/broadcast || \
    echo "  WARN: broadcast failed (계속 진행)"
  sleep 3   # 클라이언트들이 MaintenancePhase로 전환할 시간 확보
else
  echo "[0.5/8] INTERNAL_TOKEN missing — skipping broadcast"
fi

echo "[1/8] maintenance flag ON"
sudo touch /etc/nginx/maintenance.flag
docker exec poposafari-nginx-1 nginx -s reload

echo "[2/8] image pull (tag=$IMAGE_TAG)"
IMAGE_TAG=$IMAGE_TAG $COMPOSE pull api socket worker flush

echo "[3/8] recreate app containers (PG/Redis 유지)"
IMAGE_TAG=$IMAGE_TAG $COMPOSE up -d --no-deps api socket worker flush

echo "[4/8] drizzle migrate — skipped (manual schema management)"

echo "[5/8] healthcheck (30s 폴링)"
for i in $(seq 1 30); do
  if curl -sf http://localhost:9000/api/healthz; then
    echo "  healthy at attempt $i"; break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then echo "FAIL: healthcheck timeout"; exit 1; fi
done

echo "[6/8] maintenance flag OFF"
sudo rm -f /etc/nginx/maintenance.flag
docker exec poposafari-nginx-1 nginx -s reload

echo "[7/8] save deployed SHA"
echo "$IMAGE_TAG" > ~/.poposafari-current-sha

echo "[8/8] done — $IMAGE_TAG"
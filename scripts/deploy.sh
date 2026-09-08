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
# - server 컨테이너는 호스트에 publish 안 됨 → docker exec로 컨테이너 내부 localhost 호출
if [ -n "$INTERNAL_TOKEN" ]; then
  echo "[0.5/9] broadcasting maintenance to active sockets"
  docker exec poposerver_server wget -qO- \
    --header="X-Internal-Token: ${INTERNAL_TOKEN}" \
    --header="Content-Type: application/json" \
    --post-data="{}" \
    http://127.0.0.1:9000/api/__internal/maintenance/broadcast || \
    echo "  WARN: broadcast failed (계속 진행)"
  sleep 3   # 클라이언트들이 MaintenancePhase로 전환할 시간 확보
else
  echo "[0.5/9] INTERNAL_TOKEN missing — skipping broadcast"
fi

echo "[1/9] maintenance flag ON"

mkdir -p docker/prod/flags
touch docker/prod/flags/maintenance

echo "[2/9] image pull (tag=$IMAGE_TAG)"
IMAGE_TAG=$IMAGE_TAG $COMPOSE pull server

echo "[3/9] recreate app container (PG·nginx 무손상)"
# --no-deps       : postgres를 up 대상/재생성에서 제외 → 데이터 컨테이너 무손상
# --remove-orphans: 구 api/socket/worker/redis(신 compose에 없는 서비스) 정리 안전망
#                   (모놀리스 전환 1회성 청소용. 이후 steady-state에선 no-op)
IMAGE_TAG=$IMAGE_TAG $COMPOSE up -d --no-deps --remove-orphans server

echo "[3.5/9] nginx config apply"
# conf.d/ssl은 디렉터리 bind-mount라 git pull이 컨테이너에 그대로 보인다 → reload로 무중단 반영.
# 반면 nginx.conf는 단일 파일 bind-mount라 도커가 inode를 고정한다. git pull은 파일을
# 새로 쓰고 rename하므로 inode가 바뀌고, 컨테이너는 옛 파일을 계속 본다(2026-09-08 실측:
# 호스트엔 새 log_format이 있는데 `docker exec ... nginx -T`는 옛 포맷 출력).
# → 호스트와 컨테이너의 nginx.conf 해시를 비교해 다를 때만 재생성한다.
if docker ps --format '{{.Names}}' | grep -q '^poposerver_nginx$'; then
  HOST_NGINX_CONF=$(md5sum docker/prod/nginx/nginx.conf | cut -d' ' -f1)
  CTR_NGINX_CONF=$(docker exec poposerver_nginx md5sum /etc/nginx/nginx.conf 2>/dev/null | cut -d' ' -f1 || echo "unknown")

  if [ "$HOST_NGINX_CONF" != "$CTR_NGINX_CONF" ]; then
    echo "  nginx.conf changed — validating before recreate"
    # 재생성 전 검증. 깨진 config로 재생성하면 nginx가 crash-loop에 빠져 사이트가 통째로 죽는다.
    # reload와 달리 되돌릴 컨테이너가 없으므로 일회용 컨테이너로 먼저 nginx -t를 돌린다.
    docker run --rm \
      -v "$PWD/docker/prod/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" \
      -v "$PWD/docker/prod/nginx/conf.d:/etc/nginx/conf.d:ro" \
      -v "$PWD/docker/prod/nginx/ssl:/etc/nginx/ssl:ro" \
      nginx:alpine nginx -t
    $COMPOSE up -d --no-deps --force-recreate nginx
    echo "  nginx recreated (수초 다운타임)"
  else
    docker exec poposerver_nginx nginx -t
    docker exec poposerver_nginx nginx -s reload
    echo "  nginx reloaded (무중단)"
  fi
else
  # 최초 배포/cutover에서 nginx가 없던 경우만 생성
  echo "  nginx not running — creating from compose"
  $COMPOSE up -d --no-deps nginx
fi

echo "[4/9] drizzle migrate — skipped (manual schema management)"

echo "[5/9] healthcheck (60s 폴링)"

for i in $(seq 1 60); do
  STATUS=$(docker inspect -f '{{.State.Status}}' poposerver_server 2>/dev/null || echo "missing")
  RESTARTS=$(docker inspect -f '{{.RestartCount}}' poposerver_server 2>/dev/null || echo "?")

  if [ "$STATUS" = "restarting" ] || [ "$STATUS" = "exited" ]; then
    echo "FAIL: api container status=$STATUS restarts=$RESTARTS (attempt $i)"
    echo "----- docker logs poposerver_server (tail 150) -----"
    docker logs poposerver_server --tail 150 2>&1 || true
    exit 1
  fi

  if docker exec poposerver_server wget -qO- http://127.0.0.1:9000/health >/dev/null 2>&1; then
    echo "  healthy at attempt $i"; break
  fi
  sleep 1

  if [ "$i" -eq 60 ]; then
    echo "FAIL: healthcheck timeout"
    echo "----- docker logs poposerver_server (tail 150) -----"
    docker logs poposerver_server --tail 150 2>&1 || true
    exit 1
  fi
done

echo "[6/9] maintenance flag OFF"
rm -f docker/prod/flags/maintenance

echo "[7/9] save deployed SHA"
echo "$IMAGE_TAG" > ~/.poposafari-current-sha

# [8/9] 누적 이미지 정리 (디스크 84% 경보 재발 방지, 2026-06-12)
# - until=72h: 72시간 내 이미지는 보존 → 직전 SHA(롤백 타깃)는 안 지워짐.
#   설령 더 오래된 SHA가 지워져도 rollback.sh는 deploy.sh 재실행→$COMPOSE pull로 재취득하므로 안전.
# - 배포는 이미 [6/9]에서 확정됨. prune은 부가 정리라 실패해도 배포를 막지 않음(|| true).
echo "[8/9] prune old images (until=72h)"
docker image prune -af --filter "until=72h" || echo "  WARN: prune failed (무시, 배포는 정상)"

echo "[9/9] done — $IMAGE_TAG"
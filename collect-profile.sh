#!/usr/bin/env bash
# 프로젝트 루트에서 실행. 프로파일 모드로 띄운 컨테이너에서 GC 로그와 /app 내용(CPU.*.cpuprofile 등)을
# profile/ 디렉터리로 끌어옴.
# 사용: ./collect-profile.sh
# 참고: CPU 프로파일은 Node가 종료될 때만 생성됨. 수집 전에 docker stop poposerver_socket 등으로
#       해당 컨테이너를 먼저 멈춘 뒤 실행하면 .cpuprofile 을 가져올 수 있음.

set -e

COMPOSE_FILE="docker/prod/docker-compose.yml"
PROFILE_FILE="docker/prod/docker-compose.profile.yml"
ENV_FILE="docker/prod/.env.prod"
OUT_DIR="profile"

COMPOSE_CMD="docker compose -f $COMPOSE_FILE -f $PROFILE_FILE --env-file $ENV_FILE"

if [[ ! -f "$COMPOSE_FILE" ]] || [[ ! -f "$PROFILE_FILE" ]]; then
  echo "Error: Run from project root (expected $COMPOSE_FILE, $PROFILE_FILE)"
  exit 1
fi

mkdir -p "$OUT_DIR" "$OUT_DIR/api-app" "$OUT_DIR/socket-app" "$OUT_DIR/worker-app"

echo "Collecting GC logs..."
$COMPOSE_CMD logs --no-log-prefix api   > "$OUT_DIR/api-gc.log"   2>/dev/null || true
$COMPOSE_CMD logs --no-log-prefix socket > "$OUT_DIR/socket-gc.log" 2>/dev/null || true
$COMPOSE_CMD logs --no-log-prefix worker > "$OUT_DIR/worker-gc.log" 2>/dev/null || true

echo "Copying /app from api, socket, worker containers..."
for svc in api socket worker; do
  cid="poposerver_$svc"
  if docker ps -a -q -f name="^${cid}$" | grep -q .; then
    docker cp "${cid}:/app/." "$OUT_DIR/${svc}-app/" 2>/dev/null || echo "  (skip $cid: not running or /app empty)"
  else
    echo "  (skip $cid: container not found)"
  fi
done

echo "Done. Output in $OUT_DIR/"
echo "  - *-gc.log: GC logs"
echo "  - *-app/:   container /app (CPU.*.cpuprofile if process was stopped before copy)"

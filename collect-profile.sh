#!/usr/bin/env bash
# 프로젝트 루트에서 실행. 프로파일 모드로 띄운 컨테이너에서 GC 로그와 /app 내용(CPU.*.cpuprofile 등)을
# profile/ 디렉터리로 끌어옴.
# 사용: ./collect-profile.sh
# 순서: 컨테이너 중지 → GC 로그 수집 → /app 복사(CPU.*.cpuprofile 포함)

set -euo pipefail

COMPOSE_FILE="docker/prod/docker-compose.yml"
PROFILE_FILE="docker/prod/docker-compose.profile.yml"
ENV_FILE="docker/prod/.env.prod"
OUT_DIR="profile"
SERVICES=(api socket worker)

COMPOSE_CMD="docker compose -f $COMPOSE_FILE -f $PROFILE_FILE --env-file $ENV_FILE"

if [[ ! -f "$COMPOSE_FILE" ]] || [[ ! -f "$PROFILE_FILE" ]]; then
  echo "Error: Run from project root (expected $COMPOSE_FILE, $PROFILE_FILE)"
  exit 1
fi

mkdir -p "$OUT_DIR" "$OUT_DIR/api-app" "$OUT_DIR/socket-app" "$OUT_DIR/worker-app"

# Step 1: 실행 중인 컨테이너 중지 (Node 종료 → .cpuprofile 파일 생성)
echo "Stopping containers to flush CPU profiles..."
for svc in "${SERVICES[@]}"; do
  cid="poposerver_$svc"
  if docker ps -q -f "name=^${cid}$" | grep -q .; then
    docker stop "$cid" && echo "  Stopped $cid" || echo "  (failed to stop $cid)"
  else
    echo "  (skip $cid: not running)"
  fi
done
echo ""

# Step 2: GC 로그 수집 (컨테이너 중지 후에도 Docker 데몬이 로그 버퍼 보유)
echo "Collecting GC logs..."
for svc in "${SERVICES[@]}"; do
  $COMPOSE_CMD logs --no-log-prefix "$svc" > "$OUT_DIR/${svc}-gc.log" 2>/dev/null || true
  echo "  $OUT_DIR/${svc}-gc.log"
done
echo ""

# Step 3: /app 전체 복사 (CPU.*.cpuprofile 포함)
echo "Copying /app from containers..."
for svc in "${SERVICES[@]}"; do
  cid="poposerver_$svc"
  if docker ps -a -q -f "name=^${cid}$" | grep -q .; then
    docker cp "${cid}:/app/." "$OUT_DIR/${svc}-app/" 2>/dev/null \
      && echo "  Copied $cid:/app → $OUT_DIR/${svc}-app/" \
      || echo "  (skip $cid: /app copy failed)"
  else
    echo "  (skip $cid: container not found)"
  fi
done
echo ""

echo "Done. Output in $OUT_DIR/"
echo "  - *-gc.log : GC logs (컨테이너 종료 직전 로그 포함)"
echo "  - *-app/   : container /app (CPU.*.cpuprofile 포함)"
echo ""

# Step 4: 맥북으로 전송
MACBOOK_USER="ihoseob"
MACBOOK_HOST="172.30.1.30"
MACBOOK_DEST="/Users/ihoseob/Desktop/seophohoho/workspace/poposafari/test/artillery"

echo "Transferring profile data to MacBook (${MACBOOK_HOST})..."
rsync -avz --progress "$OUT_DIR/" "${MACBOOK_USER}@${MACBOOK_HOST}:${MACBOOK_DEST}/profile/"
echo ""
echo "Transfer complete. MacBook: ${MACBOOK_DEST}/profile/"

#!/usr/bin/env bash
# 점검 모드 진입 (배포와 독립적으로 직접 켤 때). 프로젝트 루트(~/poposafari/server)에서 실행.
#  1) nginx flag ON  → api/socket 요청이 503
#  2) 활성 소켓 전원 kick(reason=MAINTENANCE) → 클라 로그아웃 → 로그인 화면
# 해제: ./scripts/maintenance-off.sh
set -euo pipefail

if [ ! -f docker/prod/docker-compose.yml ]; then
  echo "Error: 프로젝트 루트(~/poposafari/server)에서 실행하세요" >&2
  exit 1
fi

# .env.prod에서 INTERNAL_TOKEN 추출 (소켓 kick broadcast 인증용)
INTERNAL_TOKEN=$(grep -E '^INTERNAL_TOKEN=' docker/prod/.env.prod 2>/dev/null | head -1 | cut -d'=' -f2- || true)

# 1) flag ON — nginx는 ./flags 를 ro 마운트하고 요청마다 -f 평가 (reload 불필요)
mkdir -p docker/prod/flags
touch docker/prod/flags/maintenance
echo "[1/2] maintenance flag ON (api/socket → 503)"

# 2) 활성 소켓 전원 kick → 클라가 로그아웃되어 로그인 화면으로
if [ -n "$INTERNAL_TOKEN" ]; then
  if docker exec poposerver_server wget -qO- \
       --header="X-Internal-Token: ${INTERNAL_TOKEN}" \
       --header="Content-Type: application/json" \
       --post-data="{}" \
       http://127.0.0.1:9000/api/__internal/maintenance/broadcast >/dev/null 2>&1; then
    echo "[2/2] active sockets kicked"
  else
    echo "[2/2] WARN: broadcast 실패 (flag는 이미 ON — 신규 요청은 차단됨)"
  fi
else
  echo "[2/2] INTERNAL_TOKEN 없음 — 소켓 kick skip (flag는 ON)"
fi

echo "점검 모드 ON. 해제하려면: ./scripts/maintenance-off.sh"

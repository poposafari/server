#!/usr/bin/env bash
# Lean 6 스모크 부하 러너 (로컬 Mac).
#   server/ 에서:  ./load-test/run-smoke.sh
#
# 하는 일: prod compose + smoke 오버레이로 스택 기동(빌드) → 빈 PG에 스키마 push →
#          STAGES(기본 50 80 100) 동접을 차례로 올리며 각 단계 docker stats 캡처 →
#          단계별 결과를 load-test/out/ 에 저장.
# 목적: 어느 컨테이너가 자기 mem_limit에 먼저 닿는지(=OOM 천장)를 찾아 SLOT_CAPACITY를 그 70% 아래로.
#
# 환경변수 override: STAGES="50 80 100 120"  DURATION=60  TEARDOWN=1(끝나고 down -v)
set -euo pipefail
cd "$(dirname "$0")/.."  # → server/

PROD=docker/prod
ENVF="$PROD/.env.smoke"
# -p poposmoke: dev 스택과 완전 격리된 별도 프로젝트(네트워크/볼륨 분리). 컨테이너명은 _smoke.
# EMULATE_2VCPU=1 → 전 컨테이너를 코어 0,1에 핀해 프로드 2-vCPU 재현(cpuset 오버레이 추가)
CPU_OVERLAY=""
[ "${EMULATE_2VCPU:-0}" = "1" ] && CPU_OVERLAY="-f $PROD/docker-compose.smoke-2cpu.yml" && echo "(2-vCPU 에뮬레이션 ON: 전 컨테이너 cpuset=0,1)"
COMPOSE="docker compose -p poposmoke -f $PROD/docker-compose.yml -f $PROD/docker-compose.smoke.yml $CPU_OVERLAY --env-file $ENVF"
SVCS="postgres redis api socket worker flush"   # nginx 제외(Mac에 없는 경로 마운트)
PG_HOST_PORT=55432                               # smoke postgres host publish(dev 5432와 분리)
STAGES="${STAGES:-50 80 100}"
DURATION="${DURATION:-60}"
OUT=load-test/out
mkdir -p "$OUT"

[ -f "$ENVF" ] || { echo "❌ $ENVF 없음 → cp $PROD/.env.smoke.example $ENVF"; exit 1; }
DBUSER=$(grep -E '^DB_USERNAME=' "$ENVF" | cut -d= -f2)

echo "==> [1/4] 스택 빌드 + 기동 ($SVCS)"
$COMPOSE up -d --build $SVCS

echo "==> [2/4] postgres 준비 대기 + 스키마 push"
until docker exec poposerver_smoke_postgres pg_isready -U "$DBUSER" >/dev/null 2>&1; do sleep 1; done
# 빈 DB라 전부 create → 파괴적 변경 없음 → 프롬프트 없이 통과.
# DB_PORT을 host publish 포트로 인라인 주입(dotenv는 기존 env를 덮어쓰지 않음 → 55432 유지).
DB_PORT="$PG_HOST_PORT" pnpm exec dotenv -e "$ENVF" -- drizzle-kit push

echo "==> [3/4] api /health 대기"
for _ in $(seq 1 60); do
  curl -fsS http://localhost:9000/health >/dev/null 2>&1 && break || sleep 1
done
curl -fsS http://localhost:9000/health >/dev/null 2>&1 && echo "   api healthy" || echo "   ⚠️ api health 미확인(계속 진행)"

echo "==> [4/4] 단계별 부하: STAGES=[$STAGES] duration=${DURATION}s"
for N in $STAGES; do
  TAG=$(date +%H%M%S)
  STATS="$OUT/stats-N${N}-${TAG}.log"
  echo
  echo "================= 동접 N=$N (tag=$TAG) ================="
  # 백그라운드 docker stats 샘플러 (10초 간격)
  (
    for _ in $(seq 1 $(( (DURATION/10) + 2 )) ); do
      echo "--- $(date -u +%H:%M:%S)Z ---" >> "$STATS"
      docker stats --no-stream --format \
        "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.CPUPerc}}" >> "$STATS" 2>/dev/null || true
      sleep 10
    done
  ) &
  STATS_PID=$!

  API_URL=http://localhost:9000 SOCKET_URL=http://localhost:9010 \
    N="$N" DURATION_SEC="$DURATION" RUN_TAG="$TAG" \
    node load-test/plaza-smoke.mjs | tee "$OUT/driver-N${N}-${TAG}.log"

  kill "$STATS_PID" 2>/dev/null || true; wait "$STATS_PID" 2>/dev/null || true

  echo "── N=$N 단계 컨테이너 메모리 피크(%) ──"
  grep -hE 'poposerver_smoke_(api|socket|postgres|redis|flush|worker)' "$STATS" \
    | awk '{print $1, $(NF-1)}' | sort | awk '
      { if ($2+0 > peak[$1]) peak[$1]=$2+0 }
      END { for (n in peak) printf "   %-22s %5.1f%%\n", n, peak[n] }' || true
  echo "   (상세: $STATS / $OUT/driver-N${N}-${TAG}.log)"

  echo "   슬롯 해제 대기 20s…"; sleep 20
done

echo
echo "✅ 완료. 결과: $OUT/  → docs/artillery/RESULT_TEMPLATE.md 로 정리"
echo "   해석: 어느 컨테이너든 mem%가 ~90%+로 치솟거나 driver 성공률이 급락하는 N이 천장."
echo "         SLOT_CAPACITY = (그 N) × 0.7 아래로 고정 권장."
if [ "${TEARDOWN:-0}" = "1" ]; then
  echo "==> TEARDOWN=1 → 스택/볼륨 제거"
  $COMPOSE down -v
fi

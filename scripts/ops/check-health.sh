#!/usr/bin/env bash
# PopoSafari 온박스 헬스 워치독 → Discord #alerts (5분 cron)
#
# 역할 분담:
#   - "박스가 시들고 있나"(메모리/CPU/디스크/컨테이너 저하) = 이 스크립트 (박스 안에서 관찰)
#   - "박스가 통째로 죽었나"(하드 다운) = 외부 uptime SaaS (UptimeRobot 등, 박스 밖)
#   이 스크립트는 박스 위에서 돌므로 자기(=박스)의 죽음은 못 알린다. 그게 정상 —
#   하드 다운 backstop은 외부 SaaS가 맡는다.
#
# 핵심 임계의 의미:
#   - 메모리 75% = 8GB 리사이즈 검토 트리거 (deployment_record.md "Lightsail 4GB를 고른 이유")
#   - CPU       = load average(5분)/코어수. 순간 스냅샷이 아니라 '지속 포화'를 본다.
#   - 디스크    = 풀(full) = outage. 도커 로그/PG 데이터 증가를 미리 잡는다.
#
# 노이즈 방지: 상태 전이(정상→경보, 경보→회복)에서만 1회 발송. 같은 상태가 지속되면 침묵.
#   (5분마다 같은 경보를 도배하면 결국 무시하게 되므로 — edge-triggered)
set -euo pipefail

# ── 설정 로드 (DISCORD_WEBHOOK_ALERTS는 .env.backup에 이미 있음 → 재사용) ──
CONFIG="${OPS_ENV:-/home/ubuntu/poposafari/server/docker/prod/.env.backup}"
# shellcheck disable=SC1090
[ -f "$CONFIG" ] && . "$CONFIG"

# cron은 최소 PATH로 돌므로 바이너리는 절대경로 (which docker 결과로 조정)
DOCKER="${DOCKER_BIN:-/usr/bin/docker}"

MEM_PCT="${MEM_PCT:-75}"                         # 메모리 사용률 경보 임계 (=리사이즈 트리거)
CPU_RATIO="${CPU_RATIO:-1.0}"                    # 코어당 5분 load 임계 (1.0 = 코어 수만큼 = 포화)
DISK_PCT="${DISK_PCT:-80}"                       # 디스크 사용률 경보 임계
DISK_PATHS="${DISK_PATHS:-/ /mnt/pgdata}"        # 감시할 마운트
CONTAINERS="${HEALTH_CONTAINERS:-poposerver_nginx poposerver_api poposerver_socket poposerver_worker poposerver_postgres poposerver_redis}"
STATE_DIR="${HEALTH_STATE_DIR:-/tmp/poposafari-health}"   # 전이 추적용 flag (재부팅 시 리셋=의도)

mkdir -p "$STATE_DIR"

notify() {
  [ -n "${DISCORD_WEBHOOK_ALERTS:-}" ] && curl -fsS -X POST -H "Content-Type: application/json" \
    -d "{\"content\":\"$1\"}" "$DISCORD_WEBHOOK_ALERTS" >/dev/null || true
}

# host 자원 경보 시 '어느 컨테이너가 범인인가'를 한 줄로 첨부 — docker stats 1회 스냅샷.
# host 메모리/CPU는 어느 컨테이너 탓인지 안 알려주므로, 경보 알림에 컨테이너별 mem/cpu를 같이 실어
# 보낸다(api인지 socket인지 postgres인지 폰에서 바로 식별). edge의 [진단함수]로 전이 순간에만 실행.
top_containers() {
  $DOCKER stats --no-stream --format '{{.Name}}(mem {{.MemUsage}}, cpu {{.CPUPerc}})' 2>/dev/null | tr '\n' ' '
}

# 상태 전이 기반 발송: edge <조건키> <bad|ok> <메시지> [진단함수]
#   bad 첫 진입 → "⚠️" 1회(+진단함수 출력 첨부) + flag 생성 / ok 회복 → "✅ 회복" 1회 + flag 제거 / 같은 상태면 무발송
#   [진단함수]는 실제 발송할 때만 실행 → docker stats 비용을 전이 순간에만 치른다(평소 0).
edge() {
  local flag="$STATE_DIR/$1"
  if [ "$2" = "bad" ]; then
    if [ ! -f "$flag" ]; then
      local extra=""
      if [ -n "${4:-}" ]; then extra="\\n$($4 || true)"; fi
      notify "⚠️ $3$extra"
      touch "$flag"
    fi
  else
    [ -f "$flag" ] && { notify "✅ 회복: $3"; rm -f "$flag"; }
  fi
  return 0   # 평상시(정상·flag 없음) else 분기가 [ -f ] 실패로 1을 반환 → set -e가 스크립트를 죽이는 것 방지
}

# ── 1) 메모리: MemAvailable 기준 (buffers/cache·swap 왜곡 배제) ──
read -r mem_total mem_avail < <(awk '/^MemTotal:/{t=$2} /^MemAvailable:/{a=$2} END{print t, a}' /proc/meminfo)
mem_pct=$(( (mem_total - mem_avail) * 100 / mem_total ))
if [ "$mem_pct" -ge "$MEM_PCT" ]; then
  edge mem bad "메모리 ${mem_pct}% (임계 ${MEM_PCT}%) — 지속 시 8GB 리사이즈 검토" top_containers
else
  edge mem ok "메모리 ${mem_pct}%"
fi

# ── 2) CPU: load average(5분) / 코어수 — 순간 스냅샷이 아니라 '지속 부하'를 본다 ──
#    load는 부동소수라 bash 산술이 안 됨 → awk로 비교/표시.
cpu_cores=$(nproc)
cpu_load5=$(awk '{print $2}' /proc/loadavg)
cpu_per_core=$(awk -v l="$cpu_load5" -v c="$cpu_cores" 'BEGIN{printf "%.2f", l/c}')
cpu_state=$(awk -v l="$cpu_load5" -v c="$cpu_cores" -v r="$CPU_RATIO" 'BEGIN{print (l >= c*r) ? "bad" : "ok"}')
if [ "$cpu_state" = "bad" ]; then
  edge cpu bad "CPU load(5m) ${cpu_load5} / ${cpu_cores}코어 = 코어당 ${cpu_per_core} (임계 ${CPU_RATIO}) — 지속 포화" top_containers
else
  edge cpu ok "CPU 코어당 load ${cpu_per_core}"
fi

# ── 3) 디스크: 루트 + PG 데이터 디스크 ──
for path in $DISK_PATHS; do
  [ -d "$path" ] || continue
  pct=$(df --output=pcent "$path" 2>/dev/null | tail -1 | tr -dc '0-9')
  avail_h=$(df -h --output=avail "$path" 2>/dev/null | tail -1 | tr -d ' ')
  key="disk_$(echo "$path" | tr -c 'a-zA-Z0-9' '_')"
  if [ -n "$pct" ] && [ "$pct" -ge "$DISK_PCT" ]; then
    edge "$key" bad "디스크 ${path} ${pct}% (잔여 ${avail_h}, 임계 ${DISK_PCT}%)"
  else
    edge "$key" ok "디스크 ${path} ${pct:-?}%"
  fi
done

# ── 4) prod 컨테이너 상태 (crashloop/unhealthy/소멸 감지) ──
for c in $CONTAINERS; do
  key="ctr_${c}"
  status=$($DOCKER inspect -f '{{.State.Status}}{{if .State.Health}}/{{.State.Health.Status}}{{end}}' "$c" 2>/dev/null || echo "missing")
  case "$status" in
    running|running/healthy) edge "$key" ok  "컨테이너 ${c}" ;;
    running/starting)        : ;;   # health 부팅 중 — 전이로 치지 않음
    *)                       edge "$key" bad "컨테이너 ${c} 상태=${status} — 재시작/crashloop 확인" ;;
  esac
done

echo "[OK] health check done (mem ${mem_pct}%)"

# ── 5) 외부 dead-man's switch heartbeat (Healthchecks.io) ──
# 스크립트가 '끝까지 완주'했을 때만 ping을 쏜다. 박스나 cron이 통째로 죽으면 ping이 끊겨
# Healthchecks.io가 'down'으로 #alerts에 알린다 — 이 스크립트(박스 안)가 못 알리는
# 하드다운(OOM 등)을 박스 밖 SaaS가 backstop하는 자리(맨 위 주석의 "외부 uptime SaaS").
# inbound가 아니라 outbound ping이라 Cloudflare 봇 차단과 무관하다.
# HC_PING_URL은 .env.backup(비커밋)에서 로드 — URL 자체가 비밀이라 git에 안 남긴다.
[ -n "${HC_PING_URL:-}" ] && curl -fsS -m 10 --retry 3 "$HC_PING_URL" >/dev/null 2>&1 || true

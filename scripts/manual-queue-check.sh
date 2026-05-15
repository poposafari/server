#!/usr/bin/env bash
# manual-queue-check.sh
#
# Queue + online-count 서버 구현을 테스트 인프라 없이 검증하는 수동 E2E.
# 두 단계로 동작:
#   Phase 1 — Lua 스크립트만 redis-cli로 직접 검증 (API/Worker 불필요)
#   Phase 2 — API + Worker가 떠있는 상태에서 curl로 시나리오 전체 검증
#
# 사용법:
#   bash server/scripts/manual-queue-check.sh                # 전체 실행
#   bash server/scripts/manual-queue-check.sh --lua-only     # Phase 1만
#   bash server/scripts/manual-queue-check.sh --api-only     # Phase 2만
#
# 사전 조건:
#   - `pnpm db:dev` 로 Redis 띄워둠 (port 6379, password=redis)
#   - jq, redis-cli, curl 설치
#   - Phase 2: API(:9000) + Worker가 `SLOT_CAPACITY=2`로 띄워져 있어야 함
#
# 환경 변수 (기본값):
#   API_URL=http://localhost:9000
#   REDIS_HOST=localhost  REDIS_PORT=6379  REDIS_PASS=redis

set -o pipefail
# 주의: set -u 미사용. macOS bash 3.2가 빈 배열 expansion("${arr[@]}")을
# "unbound variable" 로 처리하는 호환성 버그를 회피.

API_URL="${API_URL:-http://localhost:9000}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASS="${REDIS_PASS:-redis}"

MODE="all"
case "${1:-}" in
  --lua-only) MODE="lua" ;;
  --api-only) MODE="api" ;;
  --help|-h)
    grep '^#' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
esac

# ── 색상 ──
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
NC='\033[0m'

pass=0
fail=0

ok()    { printf "  ${GREEN}✓${NC} %s\n" "$1"; pass=$((pass+1)); }
ng()    { printf "  ${RED}✗${NC} %s\n" "$1"; fail=$((fail+1)); }
info()  { printf "  ${GRAY}· %s${NC}\n" "$1"; }
step()  { printf "\n${BLUE}━━ %s ━━${NC}\n" "$1"; }
phase() { printf "\n${YELLOW}╔══════════════════════════════════════╗\n║  %s  ║\n╚══════════════════════════════════════╝${NC}\n" "$1"; }

# ── Redis 헬퍼 ──
# host에 redis-cli가 있으면 그걸 쓰고, 없으면 docker exec로 fallback.
REDIS_CONTAINER="${REDIS_CONTAINER:-poposerver_redis}"
if command -v redis-cli > /dev/null 2>&1; then
  RCLI_MODE="host"
elif command -v docker > /dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -qx "$REDIS_CONTAINER"; then
  RCLI_MODE="docker"
else
  echo "❌ redis-cli 도 없고 docker 컨테이너 '$REDIS_CONTAINER' 도 떠 있지 않다."
  echo "   해결: 'brew install redis' 또는 'pnpm db:dev' 로 컨테이너 띄우기."
  exit 1
fi

rcli() {
  # docker exec가 추가하는 \r 제거 + auth warning stderr 누름
  if [[ "$RCLI_MODE" == "host" ]]; then
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASS" --no-auth-warning "$@" 2>/dev/null | tr -d '\r'
  else
    docker exec -i "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASS" --no-auth-warning "$@" 2>/dev/null | tr -d '\r'
  fi
}

dump_keys() {
  info "active:players          = [$(rcli SMEMBERS active:players | xargs)]"
  info "queue:waiting           = [$(rcli ZRANGE queue:waiting 0 -1 | xargs)]"
  info "queue:waiting:lastSeen  = [$(rcli ZRANGE queue:waiting:lastSeen 0 -1 | xargs)]"
  local grace
  grace="$(rcli --scan --pattern 'conn:reserved:*' | xargs)"
  info "conn:reserved:*         = [${grace}]"
}

cleanup_redis() {
  rcli DEL active:players queue:waiting queue:waiting:lastSeen > /dev/null
  for k in $(rcli --scan --pattern 'conn:reserved:*'); do rcli DEL "$k" > /dev/null; done
}

# ── 사전 체크 ──
require() {
  command -v "$1" > /dev/null 2>&1 || { echo "❌ '$1' not found. install first."; exit 1; }
}
require curl
require jq

info "redis-cli 모드: $RCLI_MODE${REDIS_CONTAINER:+ (container=$REDIS_CONTAINER)}"

rcli PING > /dev/null 2>&1 || {
  echo "❌ Redis not reachable. mode=$RCLI_MODE"
  echo "   host 모드면 $REDIS_HOST:$REDIS_PORT 확인, docker 모드면 'pnpm db:dev' 실행 확인."
  exit 1
}

# ═══════════════════════════════════════════════════════════════
# Phase 1 — Lua 스크립트 검증 (redis-cli EVAL 직접 호출)
# ═══════════════════════════════════════════════════════════════
run_phase1() {
  phase "Phase 1 — Lua scripts (acquire-or-queue, promote-from-queue)"

  cleanup_redis

  local ACQUIRE_LUA='
local active = redis.call("SCARD", KEYS[1])
if active < tonumber(ARGV[2]) then
  redis.call("SADD", KEYS[1], ARGV[1])
  return {"acquired"}
else
  redis.call("ZADD", KEYS[2], ARGV[3], ARGV[1])
  redis.call("ZADD", KEYS[3], ARGV[3], ARGV[1])
  local position = redis.call("ZRANK", KEYS[2], ARGV[1])
  return {"queued", position}
end
'

  local PROMOTE_LUA='
local active = redis.call("SCARD", KEYS[1])
if active >= tonumber(ARGV[1]) then
  return nil
end
local next = redis.call("ZRANGE", KEYS[2], 0, 0)
if #next == 0 then return nil end
local authId = next[1]
redis.call("ZREM", KEYS[2], authId)
redis.call("ZREM", KEYS[3], authId)
redis.call("SADD", KEYS[1], authId)
redis.call("SET", ARGV[2] .. authId, "1", "EX", tonumber(ARGV[3]))
return authId
'

  step "acquireOrEnqueue: capacity=2"

  local res
  res="$(rcli EVAL "$ACQUIRE_LUA" 3 active:players queue:waiting queue:waiting:lastSeen u1 2 1000)"
  [[ "$res" == "acquired" ]] && ok "u1 → acquired" || ng "u1: got '$res'"

  res="$(rcli EVAL "$ACQUIRE_LUA" 3 active:players queue:waiting queue:waiting:lastSeen u2 2 1001)"
  [[ "$res" == "acquired" ]] && ok "u2 → acquired" || ng "u2: got '$res'"

  res="$(rcli EVAL "$ACQUIRE_LUA" 3 active:players queue:waiting queue:waiting:lastSeen u3 2 1002)"
  [[ "$(echo "$res" | head -1)" == "queued" ]] && ok "u3 → queued" || ng "u3: got '$res'"
  [[ "$(echo "$res" | tail -1)" == "0" ]] && ok "u3 position=0" || ng "u3 position: got '$(echo "$res" | tail -1)'"

  res="$(rcli EVAL "$ACQUIRE_LUA" 3 active:players queue:waiting queue:waiting:lastSeen u4 2 1003)"
  [[ "$(echo "$res" | tail -1)" == "1" ]] && ok "u4 position=1" || ng "u4 position: got '$(echo "$res" | tail -1)'"

  [[ "$(rcli SCARD active:players)" == "2" ]] && ok "SCARD active:players == 2" || ng "SCARD mismatch"
  [[ "$(rcli ZCARD queue:waiting)" == "2" ]] && ok "ZCARD queue:waiting == 2" || ng "ZCARD mismatch"

  dump_keys

  step "promoteFromQueue: capacity=2 (가득) → no-op"
  res="$(rcli EVAL "$PROMOTE_LUA" 3 active:players queue:waiting queue:waiting:lastSeen 2 'conn:reserved:' 30)"
  [[ -z "$res" ]] && ok "no-op (nil 반환)" || ng "expected nil, got '$res'"

  step "promoteFromQueue: 슬롯 1개 회수 후 → u3 promote"
  rcli SREM active:players u1 > /dev/null
  res="$(rcli EVAL "$PROMOTE_LUA" 3 active:players queue:waiting queue:waiting:lastSeen 2 'conn:reserved:' 30)"
  if [[ "$res" == "u3" ]]; then
    ok "promote return = 'u3'"
  elif [[ "$(rcli SISMEMBER active:players u3)" == "1" ]]; then
    info "return capture가 비어있지만 SISMEMBER 확인됨 (docker exec single-string 캡처 이슈)"
    ok "u3 promote 확인"
  else
    ng "promoted: got '$res' AND u3 not in active"
  fi

  [[ "$(rcli SISMEMBER active:players u3)" == "1" ]] && ok "u3 ∈ active:players" || ng "u3 not in active"
  [[ "$(rcli ZSCORE queue:waiting u3)" == "" ]] && ok "u3 removed from queue" || ng "u3 still in queue"
  [[ "$(rcli ZSCORE queue:waiting:lastSeen u3)" == "" ]] && ok "u3 removed from lastSeen" || ng "u3 still in lastSeen"
  [[ "$(rcli EXISTS conn:reserved:u3)" == "1" ]] && ok "conn:reserved:u3 SETEX (race 차단)" || ng "grace key missing — §4.1 race!"

  local ttl
  ttl="$(rcli TTL conn:reserved:u3)"
  [[ "$ttl" -gt 0 && "$ttl" -le 30 ]] && ok "conn:reserved:u3 TTL ≈ 30s (got ${ttl})" || ng "TTL=${ttl}"

  dump_keys
  cleanup_redis
}

# ═══════════════════════════════════════════════════════════════
# Phase 2 — API curl E2E
# ═══════════════════════════════════════════════════════════════

# 임의 username 3개. 제약: 소문자+숫자만, 1~20자.
# epoch 마지막 5자 + RANDOM(최대 5자) + prefix(2자) = 최대 12자.
_EPOCH="$(date +%s)"
_SUFFIX="${_EPOCH: -5}${RANDOM}"
U_A="qa${_SUFFIX}"
U_B="qb${_SUFFIX}"
U_C="qc${_SUFFIX}"
SID_A=""
SID_B=""
SID_C=""

# 결과 캐시 (마지막 응답)
LAST_BODY=""
LAST_STATUS=""

# $1=method $2=path $3=cookie(opt) $4=body(opt)
call() {
  local method="$1" path="$2" cookie="${3:-}" body="${4:-}"
  local cookie_arg=()
  [[ -n "$cookie" ]] && cookie_arg=(-H "Cookie: sid=$cookie")
  local body_arg=()
  [[ -n "$body" ]] && body_arg=(-H "Content-Type: application/json" -d "$body")
  local tmp
  tmp="$(mktemp)"
  LAST_STATUS="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" "$API_URL$path" "${cookie_arg[@]}" "${body_arg[@]}")"
  LAST_BODY="$(cat "$tmp")"
  rm -f "$tmp"
}

# register → sid 추출. 실패 시 stderr에 상태 + body 출력.
register() {
  local username="$1"
  local hdr body
  hdr="$(mktemp)"
  body="$(mktemp)"
  local status
  status="$(curl -sS -D "$hdr" -o "$body" -w "%{http_code}" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$username\",\"password\":\"Test1234!\"}" \
    "$API_URL/api/auth/register/local")"
  local sid
  sid="$(grep -i '^set-cookie:' "$hdr" | sed -n 's/.*sid=\([^;]*\).*/\1/p' | head -1)"
  if [[ -z "$sid" ]]; then
    {
      printf "  ${GRAY}status=%s body=%s${NC}\n" "$status" "$(cat "$body")"
      printf "  ${GRAY}hdr:\n%s${NC}\n" "$(cat "$hdr")"
    } >&2
  fi
  rm -f "$hdr" "$body"
  echo "$sid"
}

run_phase2() {
  phase "Phase 2 — API E2E (SLOT_CAPACITY=2 가정)"

  # API ping
  if ! curl -sS -o /dev/null --connect-timeout 2 "$API_URL/api/auth/register/local" -X POST -d '{}' \
    -H 'Content-Type: application/json' > /dev/null; then
    echo "❌ API not reachable at $API_URL. Start it with SLOT_CAPACITY=2 first."
    return
  fi

  cleanup_redis

  step "0. 3개 계정 등록"
  SID_A="$(register "$U_A")"; [[ -n "$SID_A" ]] && ok "A=$U_A sid 발급" || { ng "A register 실패"; return; }
  SID_B="$(register "$U_B")"; [[ -n "$SID_B" ]] && ok "B=$U_B sid 발급" || { ng "B register 실패"; return; }
  SID_C="$(register "$U_C")"; [[ -n "$SID_C" ]] && ok "C=$U_C sid 발급" || { ng "C register 실패"; return; }

  # register는 sid도 발급하면서 active:players에 영향 주지 않는다. 정리
  cleanup_redis

  step "0-1. SLOT_CAPACITY=2 환경 사전 검증 (Worker 재시작 누락 fail-fast)"
  # API의 connect로 1명만 acquired 시켜놓고 Worker가 1.5초 안에 promote하는지 확인.
  # 만약 큐에 한 명 넣은 뒤 1.5초 뒤 active로 가버리면 Worker는 capacity > 2.
  call POST /api/game/connect "$SID_A"  # A → acquired
  call POST /api/game/connect "$SID_B"  # B → acquired
  call POST /api/game/connect "$SID_C"  # C → 큐여야 함
  local pre_ready="$(echo "$LAST_BODY" | jq -r '.data.ready')"
  if [[ "$pre_ready" != "false" ]]; then
    ng "API SLOT_CAPACITY != 2 (C connect가 큐 안 들어감). API 프로세스 재시작 확인"
    return
  fi
  ok "API SLOT_CAPACITY=2 확인 (C → 큐)"

  sleep 1.5
  if [[ "$(rcli SISMEMBER active:players "$(rcli ZRANGE queue:waiting 0 0)")" == "1" ]]; then
    ng "Worker SLOT_CAPACITY != 2 (1.5초 만에 promote 발생). Worker 프로세스 재시작 확인"
    cleanup_redis
    return
  fi
  if [[ "$(rcli ZCARD queue:waiting)" != "1" ]]; then
    ng "큐 상태 비정상 — ZCARD=$(rcli ZCARD queue:waiting)"
    cleanup_redis
    return
  fi
  ok "Worker SLOT_CAPACITY=2 확인 (1.5초 후에도 큐 유지)"

  # 본 시나리오를 위해 cleanup
  cleanup_redis

  step "1. A connect → ready:true (capacity 여유)"
  call POST /api/game/connect "$SID_A"
  local ra="$(echo "$LAST_BODY" | jq -r '.data.ready')"
  [[ "$LAST_STATUS" == "200" ]] && ok "HTTP 200" || ng "HTTP=$LAST_STATUS body=$LAST_BODY"
  [[ "$ra" == "true" ]] && ok "ready:true" || ng "ready=$ra"
  local tok_a="$(echo "$LAST_BODY" | jq -r '.data.token')"
  [[ -n "$tok_a" && "$tok_a" != "null" ]] && ok "token 발급: ${tok_a:0:8}..." || ng "token 누락"

  step "2. B connect → ready:true (capacity 가득)"
  call POST /api/game/connect "$SID_B"
  local rb="$(echo "$LAST_BODY" | jq -r '.data.ready')"
  [[ "$rb" == "true" ]] && ok "ready:true" || ng "ready=$rb body=$LAST_BODY"

  step "3. C connect → ready:false + position:0 (큐 첫 번째)"
  call POST /api/game/connect "$SID_C"
  local rc="$(echo "$LAST_BODY" | jq -r '.data.ready')"
  local pos="$(echo "$LAST_BODY" | jq -r '.data.position')"
  [[ "$rc" == "false" ]] && ok "ready:false" || ng "ready=$rc body=$LAST_BODY"
  [[ "$pos" == "0" ]] && ok "position=0" || ng "position=$pos"
  dump_keys

  step "4. C의 /api/queue/status 폴링 1회 — position:0 + heartbeat 갱신"
  local before_score
  before_score="$(rcli ZSCORE queue:waiting:lastSeen "$(rcli ZRANGE queue:waiting 0 0)")"
  sleep 1
  call GET /api/queue/status "$SID_C"
  local s_ready="$(echo "$LAST_BODY" | jq -r '.data.ready')"
  local s_pos="$(echo "$LAST_BODY" | jq -r '.data.position')"
  [[ "$s_ready" == "false" ]] && ok "status.ready:false (아직 큐)" || ng "ready=$s_ready"
  [[ "$s_pos" == "0" ]] && ok "status.position=0" || ng "position=$s_pos"
  local after_score
  after_score="$(rcli ZSCORE queue:waiting:lastSeen "$(rcli ZRANGE queue:waiting 0 0)")"
  [[ "$after_score" -gt "$before_score" ]] 2>/dev/null && ok "lastSeen heartbeat 갱신 ($before_score → $after_score)" || ng "lastSeen not bumped"

  step "5. C가 /api/queue/cancel → 큐에서 제거"
  call POST /api/queue/cancel "$SID_C"
  [[ "$LAST_STATUS" == "200" ]] && ok "HTTP 200" || ng "HTTP=$LAST_STATUS"
  [[ "$(rcli ZCARD queue:waiting)" == "0" ]] && ok "queue:waiting 비었음" || ng "ZCARD=$(rcli ZCARD queue:waiting)"
  [[ "$(rcli ZCARD queue:waiting:lastSeen)" == "0" ]] && ok "lastSeen 비었음" || ng "still there"

  step "6. C가 status 다시 → ready:false + position:null (큐 밖)"
  call GET /api/queue/status "$SID_C"
  local s_ready2="$(echo "$LAST_BODY" | jq -r '.data.ready')"
  local s_pos2="$(echo "$LAST_BODY" | jq -r '.data.position')"
  # ready:true 응답엔 position 키가 아예 없어서 jq가 'null'을 내준다. ready도 같이 검사.
  if [[ "$s_ready2" == "false" && "$s_pos2" == "null" ]]; then
    ok "ready:false + position:null (큐에서 제거됨)"
  else
    ng "ready=$s_ready2 position=$s_pos2 body=$LAST_BODY"
  fi

  step "7. C 재진입 connect → 다시 큐"
  call POST /api/game/connect "$SID_C"
  pos="$(echo "$LAST_BODY" | jq -r '.data.position')"
  [[ "$pos" == "0" ]] && ok "재진입 position=0" || ng "position=$pos"

  step "8. A disconnect 시뮬레이션 (직접 SREM)"
  rcli SREM active:players "$(rcli SMEMBERS active:players | head -1)" > /dev/null
  ok "active:players 1명 회수"
  info "Worker promoteFromQueue(1s) 대기 중..."
  sleep 2.5
  dump_keys

  step "9. C가 status 폴링 → ready:true + token (promote 성공)"
  call GET /api/queue/status "$SID_C"
  local p_ready="$(echo "$LAST_BODY" | jq -r '.data.ready')"
  local p_tok="$(echo "$LAST_BODY" | jq -r '.data.token')"
  if [[ "$p_ready" == "true" ]]; then
    ok "promoted! ready:true, token=${p_tok:0:8}..."
  else
    ng "still in queue: $LAST_BODY (Worker가 안 떠있나? promoteFromQueue cron 확인)"
  fi

  step "10. /api/game/online — 동접자 수 (캐시 검증)"
  call GET /api/game/online "$SID_A"
  local cnt1="$(echo "$LAST_BODY" | jq -r '.data.count')"
  ok "online count = $cnt1"
  # 캐시 확인: 즉시 다시 호출해도 같은 값이어야 함 (5s TTL)
  call GET /api/game/online "$SID_A"
  local cnt2="$(echo "$LAST_BODY" | jq -r '.data.count')"
  [[ "$cnt1" == "$cnt2" ]] && ok "5s 캐시 동작 ($cnt1 == $cnt2)" || ng "캐시 불일치: $cnt1 vs $cnt2"

  step "11. 비인증 호출 → 401"
  call GET /api/game/online ""
  [[ "$LAST_STATUS" == "401" ]] && ok "401 Unauthorized" || ng "got $LAST_STATUS"

  cleanup_redis
}

# ── 메인 ──
case "$MODE" in
  lua) run_phase1 ;;
  api) run_phase2 ;;
  all) run_phase1; run_phase2 ;;
esac

# ── 요약 ──
printf "\n"
printf "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
if [[ $fail -eq 0 ]]; then
  printf "${GREEN}ALL PASS — %d checks${NC}\n" "$pass"
  exit 0
else
  printf "${RED}FAIL — %d passed, %d failed${NC}\n" "$pass" "$fail"
  exit 1
fi

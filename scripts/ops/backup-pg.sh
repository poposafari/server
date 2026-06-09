#!/usr/bin/env bash
# PopoSafari PostgreSQL 논리 백업 → Cloudflare R2 (6시간 주기 cron)
#
# 설계: 날짜+시각이 박힌 파일명(s3://.../pg/2026-06-08T0600Z.sql.gz)으로 매번 새 키.
#       덮어쓰기 없음(버저닝 불필요), 30일 만료는 R2 Lifecycle이 서버 측에서 처리.
# 안전: gzip 무결성 + 크기 하한을 통과한 덤프만 업로드한다.
#       → 잘린/빈 백업이 올라가 "백업 있음"이라는 거짓 안도감을 주는 사고를 차단.
set -euo pipefail

# ── 설정 로드 (git에 안 올라가는 값: R2 endpoint, Discord webhook) ──
CONFIG="${BACKUP_ENV:-/home/ubuntu/poposafari/server/docker/prod/.env.backup}"
# shellcheck disable=SC1090
[ -f "$CONFIG" ] && . "$CONFIG"

# cron은 최소 PATH로 돌므로 바이너리는 절대경로 (which docker / which aws 결과로 조정)
DOCKER="${DOCKER_BIN:-/usr/bin/docker}"
AWS="${AWS_BIN:-/usr/bin/aws}"

# R2 (S3 호환)
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required   # R2 체크섬 호환 (CLI v2 호환 이슈 회피)
PROFILE="${R2_PROFILE:-r2}"
ENDPOINT="${R2_ENDPOINT:?R2_ENDPOINT not set — docker/prod/.env.backup 확인}"
BUCKET="${R2_BUCKET:-poposafari-backups}"
PG_CONTAINER="${PG_CONTAINER:-poposerver_postgres}"
MIN_SIZE="${MIN_SIZE:-100000}"   # 100KB 하한 (게임 성장에 맞춰 상향)

STAMP=$(date -u +%Y-%m-%dT%H%MZ)
TMP=$(mktemp /tmp/pg-XXXXXX.sql.gz)
trap 'rm -f "$TMP"' EXIT

fail() {
  echo "[FAIL] $1" >&2
  if [ -n "${DISCORD_WEBHOOK_ALERTS:-}" ]; then
    curl -fsS -X POST -H "Content-Type: application/json" \
      -d "{\"content\":\"❌ PG 백업 실패: $1\"}" "$DISCORD_WEBHOOK_ALERTS" || true
  fi
  exit 1
}

# 1) 컨테이너 안에서 덤프 → gzip → 임시파일
#    유저/DB명은 컨테이너 env(POSTGRES_USER/DB)에서 그대로 → .env 표류와 무관
$DOCKER exec "$PG_CONTAINER" sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip > "$TMP" || fail "pg_dump 실패"

# 2) 무결성 검증 — 잘린 gzip이면 여기서 탈락 → 업로드 자체를 안 함
gzip -t "$TMP" || fail "gzip 무결성 검증 실패"

# 3) 크기 하한 — 빈/이상 덤프 방어
SIZE=$(stat -c%s "$TMP")
[ "$SIZE" -ge "$MIN_SIZE" ] || fail "덤프가 너무 작음: ${SIZE}B (하한 ${MIN_SIZE}B)"

# 4) 검증 통과분만 업로드
$AWS s3 cp "$TMP" "s3://$BUCKET/pg/$STAMP.sql.gz" \
  --profile "$PROFILE" --endpoint-url "$ENDPOINT" || fail "R2 업로드 실패"

echo "[OK] pg backup $STAMP (${SIZE}B)"

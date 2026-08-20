#!/usr/bin/env bash
set -euo pipefail

CONFIG="${BACKUP_ENV:-/home/ubuntu/poposafari/server/docker/prod/.env.backup}"
# shellcheck disable=SC1090
[ -f "$CONFIG" ] && . "$CONFIG"

DOCKER="${DOCKER_BIN:-/usr/bin/docker}"
AWS="${AWS_BIN:-/usr/bin/aws}"

export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
PROFILE="${R2_PROFILE:-r2}"
ENDPOINT="${R2_ENDPOINT:?R2_ENDPOINT not set — docker/prod/.env.backup 확인}"
BUCKET="${R2_BUCKET:-poposafari-db-backups}"
PG_CONTAINER="${PG_CONTAINER:-poposerver_postgres}"
LAG_MINUTES="${AUDIT_LAG_MINUTES:-5}"
REPORT_WEBHOOK="${DISCORD_WEBHOOK_AUDIT:-${DISCORD_WEBHOOK_ALERTS:-}}"
REPORT_EMPTY="${AUDIT_REPORT_EMPTY:-0}"
WARN_ROWS="${AUDIT_WARN_ROWS:-500000}"
WARN_DELETE_SEC="${AUDIT_WARN_DELETE_SEC:-10}"

STAMP=$(date -u +%Y-%m-%dT%H%MZ)
DATEPATH=$(date -u +%Y/%m/%d)
TMP=$(mktemp /tmp/audit-XXXXXX.jsonl.gz)
trap 'rm -f "$TMP"' EXIT

notify() {
  [ -n "${DISCORD_WEBHOOK_ALERTS:-}" ] && curl -fsS -X POST -H "Content-Type: application/json" \
    -d "{\"content\":\"$1\"}" "$DISCORD_WEBHOOK_ALERTS" || true
}

report() {
  [ -n "$REPORT_WEBHOOK" ] && curl -fsS -X POST -H "Content-Type: application/json" \
    -d "$1" "$REPORT_WEBHOOK" >/dev/null || true
}

human() {
  awk -v b="$1" 'BEGIN{
    split("B KB MB GB TB", u, " "); i=1
    while (b >= 1024 && i < 5) { b /= 1024; i++ }
    printf (i == 1 ? "%d%s" : "%.1f%s"), b, u[i]
  }'
}

fail() {
  echo "[FAIL] $1" >&2
  notify "❌ audit 아카이브 실패: $1"
  exit 1
}

psql_q() {
  $DOCKER exec "$PG_CONTAINER" sh -c \
    "PGPASSWORD=\"\$POSTGRES_PASSWORD\" psql -h 127.0.0.1 -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -qAt $1"
}

psql_stream() {
  printf '%s\n' "$1" | $DOCKER exec -i "$PG_CONTAINER" sh -c \
    "PGPASSWORD=\"\$POSTGRES_PASSWORD\" psql -h 127.0.0.1 -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -qAt -v FETCH_COUNT=1000 -f -"
}

CUTOFF=$(psql_q "-c \"SELECT coalesce(max(id),0) FROM audit_log WHERE created_at < now() - interval '${LAG_MINUTES} minutes'\"") \
  || fail "CUTOFF 조회 실패"
[ -n "$CUTOFF" ] || fail "CUTOFF 비어 있음"

if [ "$CUTOFF" -eq 0 ]; then
  echo "[OK] audit archive skipped — 대상 없음"
  [ "$REPORT_EMPTY" = "1" ] && report '{"content":"🗄️ audit 아카이브 — 대상 없음 (테이블 비어 있음)"}'
  exit 0
fi

ROWS=$(psql_q "-c \"SELECT count(*) FROM audit_log WHERE id <= $CUTOFF\"") || fail "row count 조회 실패"
FIRST_ID=$(psql_q "-c \"SELECT coalesce(min(id),0) FROM audit_log WHERE id <= $CUTOFF\"") || fail "min id 조회 실패"

if [ "$ROWS" -eq 0 ]; then
  echo "[OK] audit archive skipped — rows=0 (cutoff=$CUTOFF)"
  [ "$REPORT_EMPTY" = "1" ] && report "{\"content\":\"🗄️ audit 아카이브 — 새 로그 없음 (cutoff=\`$CUTOFF\`)\"}"
  exit 0
fi

T0=$(date +%s)
psql_stream "SELECT row_to_json(t) FROM (SELECT * FROM audit_log WHERE id <= $CUTOFF ORDER BY id) t;" \
  | gzip > "$TMP" || fail "export 실패 (cutoff=$CUTOFF)"

gzip -t "$TMP" || fail "gzip 무결성 검증 실패 (cutoff=$CUTOFF)"

LINES=$(gzip -dc "$TMP" | wc -l | tr -d ' ')
[ "$LINES" -eq "$ROWS" ] || fail "행 수 불일치: export=$LINES expected=$ROWS (cutoff=$CUTOFF)"

SIZE=$(stat -c%s "$TMP")
KEY="audit/$DATEPATH/audit-$STAMP-$CUTOFF.jsonl.gz"

$AWS s3 cp "$TMP" "s3://$BUCKET/$KEY" \
  --profile "$PROFILE" --endpoint-url "$ENDPOINT" || fail "R2 업로드 실패 ($KEY)"

$AWS s3api head-object --bucket "$BUCKET" --key "$KEY" \
  --profile "$PROFILE" --endpoint-url "$ENDPOINT" >/dev/null 2>&1 \
  || fail "업로드 검증 실패 — head-object 실패 ($KEY)"

T1=$(date +%s)
UPLOAD_SEC=$((T1 - T0))

psql_q "-c \"DELETE FROM audit_log WHERE id <= $CUTOFF\"" >/dev/null || fail "DELETE 실패 (업로드는 완료됨, cutoff=$CUTOFF)"
T2=$(date +%s)
DELETE_SEC=$((T2 - T1))
REMAIN=$(psql_q "-c \"SELECT count(*) FROM audit_log\"" 2>/dev/null || echo "?")

echo "[OK] audit archive cutoff=$CUTOFF rows=$ROWS bytes=$SIZE upload_sec=$UPLOAD_SEC delete_sec=$DELETE_SEC key=$KEY"

HSIZE=$(human "$SIZE")
FIELDS="{\"name\":\"저장 건수\",\"value\":\"\`$ROWS\` rows\",\"inline\":true}"
FIELDS="$FIELDS,{\"name\":\"id 범위\",\"value\":\"\`$FIRST_ID\` ~ \`$CUTOFF\`\",\"inline\":true}"
FIELDS="$FIELDS,{\"name\":\"압축 크기\",\"value\":\"\`$HSIZE\`\",\"inline\":true}"
FIELDS="$FIELDS,{\"name\":\"소요\",\"value\":\"업로드 ${UPLOAD_SEC}s / 삭제 ${DELETE_SEC}s\",\"inline\":true}"
FIELDS="$FIELDS,{\"name\":\"남은 로그\",\"value\":\"\`$REMAIN\` rows\",\"inline\":true}"
FIELDS="$FIELDS,{\"name\":\"R2 키\",\"value\":\"\`$KEY\`\",\"inline\":false}"

report "{\"embeds\":[{\"title\":\"🗄️ audit 로그 아카이브 완료\",\"color\":3066993,\"fields\":[$FIELDS]}]}"

if [ "$ROWS" -ge "$WARN_ROWS" ] || [ "$DELETE_SEC" -ge "$WARN_DELETE_SEC" ]; then
  notify "📈 audit 아카이브 임계 도달 — rows=$ROWS delete=${DELETE_SEC}s size=${SIZE}B (주기 단축 검토)"
fi

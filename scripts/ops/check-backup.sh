#!/usr/bin/env bash
# 최신 PG 백업이 8시간 넘게 안 끊겼는지 확인 → 끊겼으면 Discord #alerts (매시간 cron)
#
# "오늘 파일 있나"가 아니라 "최신 백업이 너무 오래됐나"를 본다.
# 존재만 체크하면 잘린 백업·죽은 cron을 못 잡는다.
set -euo pipefail

CONFIG="${BACKUP_ENV:-/home/ubuntu/poposafari/server/docker/prod/.env.backup}"
# shellcheck disable=SC1090
[ -f "$CONFIG" ] && . "$CONFIG"

AWS="${AWS_BIN:-/usr/bin/aws}"
PROFILE="${R2_PROFILE:-r2}"
ENDPOINT="${R2_ENDPOINT:?R2_ENDPOINT not set — docker/prod/.env.backup 확인}"
BUCKET="${R2_BUCKET:-poposafari-backups}"
MAX_AGE="${MAX_AGE:-28800}"   # 8시간 (주기 6h + 여유 2h)

notify() {
  [ -n "${DISCORD_WEBHOOK_ALERTS:-}" ] && curl -fsS -X POST -H "Content-Type: application/json" \
    -d "{\"content\":\"$1\"}" "$DISCORD_WEBHOOK_ALERTS" || true
}

NEWEST=$($AWS s3api list-objects-v2 --bucket "$BUCKET" --prefix pg/ \
  --profile "$PROFILE" --endpoint-url "$ENDPOINT" \
  --query 'sort_by(Contents,&LastModified)[-1].LastModified' --output text 2>/dev/null || echo "None")

if [ "$NEWEST" = "None" ] || [ -z "$NEWEST" ]; then
  notify "⚠️ PG 백업을 하나도 못 찾음 — cron/권한 즉시 확인"
  exit 1
fi

AGE=$(( $(date -u +%s) - $(date -u -d "$NEWEST" +%s) ))
if [ "$AGE" -gt "$MAX_AGE" ]; then
  notify "⚠️ PG 백업이 ${AGE}초째 갱신 안 됨 (최신: $NEWEST) — 즉시 확인"
fi
echo "[OK] newest backup: $NEWEST (age ${AGE}s)"

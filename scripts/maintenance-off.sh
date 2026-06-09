#!/usr/bin/env bash
# 점검 모드 해제. 프로젝트 루트(~/poposafari/server)에서 실행.
# flag OFF → api/socket 즉시 정상화 (nginx가 요청마다 -f 평가하므로 reload 불필요).
# 유저는 다음 로그인 시도부터 정상 접속된다.
set -euo pipefail

if [ ! -f docker/prod/docker-compose.yml ]; then
  echo "Error: 프로젝트 루트(~/poposafari/server)에서 실행하세요" >&2
  exit 1
fi

rm -f docker/prod/flags/maintenance
echo "maintenance flag OFF — api/socket 정상화"

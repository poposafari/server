# load-test — Lean 6 스모크 부하

동접 천장을 대략 찾아 `SLOT_CAPACITY`를 그 아래로 고정하기 위한 **로컬(Mac) 스모크** 하니스.
정밀 부하(정식 Phase 6)가 아니라 "어디서 무너지나" 30분 스모크.

## 무엇을 재나

prod `docker-compose.yml` + `docker-compose.smoke.yml` 오버레이로 **prod와 동일한 per-container
mem_limit + OOM 가드**(`--max-old-space-size`, redis `noeviction`)를 강제한 채, 동접을
50→80→100으로 올리며 **어느 컨테이너가 자기 메모리 한도에 먼저 닿는지**를 본다.

> ⚠️ 한계: 컨테이너 단위 OOM은 충실히 재현되지만 호스트 4GB '총량' 경합/swap은 재현 안 됨
> (Mac RAM이 큼). 절대 천장은 보수적으로 해석하고, 진짜 4GB 천장이 궁금하면 임시 Lightsail
> 4GB 스테이징(정식 Phase 6)에서 동일 하니스를 돌린다.

## 빠른 실행

```bash
cd server
cp docker/prod/.env.smoke.example docker/prod/.env.smoke   # 최초 1회
./load-test/run-smoke.sh
```

러너가 하는 일: 스택 빌드+기동(nginx 제외) → 빈 PG에 `drizzle-kit push` → `api/health` 대기
→ STAGES(기본 `50 80 100`) 차례로 부하 + 각 단계 `docker stats` 캡처 → 결과를 `load-test/out/`에.

### 옵션 (환경변수)

```bash
STAGES="50 80 100 120" DURATION=90 ./load-test/run-smoke.sh   # 단계/지속시간 조정
TEARDOWN=1 ./load-test/run-smoke.sh                           # 끝나고 컨테이너+볼륨 제거
```

### 드라이버 단독 실행 (스택이 이미 떠 있을 때)

```bash
API_URL=http://localhost:9000 SOCKET_URL=http://localhost:9010 \
  N=80 DURATION_SEC=60 RUN_TAG=$(date +%H%M%S) node load-test/plaza-smoke.mjs
```

드라이버 env: `N`(동접), `DURATION_SEC`(유지 시간), `MOVE_INTERVAL_MS`(기본 500),
`ARRIVAL_PER_SEC`(투입 속도, 기본 20), `RUN_TAG`(유저명 네임스페이스), `VERBOSE=1`(에러 출력).

## 결과 읽기

- `out/driver-N*.log` — onboarding/connect/socket 카운트, latency p50/p95/max, **init_ok 성공률**, errors
- `out/stats-N*.log` — 10초 간격 `docker stats`(컨테이너별 mem%/cpu%)
- **천장 판정**: 어느 컨테이너든 mem%가 ~90%+로 치솟거나 driver 성공률이 급락하는 N.
- **권장 `SLOT_CAPACITY`** = (그 N) × 0.7 아래.
- 정리는 `docs/artillery/RESULT_TEMPLATE.md` 복사해서 채운다.

## 동작 원리 (유저당 6단계)

`register/local` → `user/create`(닉네임·성별·코스튬) → `user/me`(여기서 Redis `user:state`
lazy-create) → `game/connect`(SLOT 획득 + conn 토큰) → socket 핸드셰이크(`auth.token`) →
`init` → `move` 루프. 재실행 시 register 충돌은 login으로 폴백.

## 주의

- `.env.smoke`는 **로컬 throwaway 값**이며 gitignore. prod 비밀과 무관.
- 스택은 prod 컨테이너 이름(`poposerver_*`)을 그대로 쓴다 → **실서버가 아닌 로컬 Docker에서만** 실행.
- 레이트리밋은 `.env.smoke`에서 OFF(`RATE_LIMIT_ENABLED=false`), `SLOT_CAPACITY=1000`
  (슬롯 게이트가 OOM보다 먼저 막지 않게).

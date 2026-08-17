-- RIDE-300 부하테스트 더미 계정 시드 (psql 전용 · 호스트에 node_modules 불필요)
--
-- 미니PC에서:
--   docker cp scripts/ops/seed-loadtest-accounts.sql poposerver_postgres:/tmp/seed.sql
--   docker exec -e PGPASSWORD=<DB_PASSWORD> poposerver_postgres \
--     psql -U <DB_USERNAME> -d <DB_DATABASE> -v count=300 -v map=p001 -f /tmp/seed.sql
--
-- 정리:
--   docker exec ... psql ... -c "DELETE FROM account WHERE provider='local' AND provider_id LIKE 'loadtest%';"
--   (user / user_costume / user_item 은 FK on delete cascade 로 같이 지워진다)
--
-- 비밀번호: loadtest1
--   아래 해시는 bcrypt cost 10 으로 **미리 1회 계산한 값**이다. salt 가 해시 안에 박혀 있어
--   전 계정이 같은 해시를 공유해도 bcrypt.compare 가 그대로 통과한다.
--   (300회 해싱을 Celeron N3150 에 시키지 않으려는 것)
--
-- 멱등: 이미 있는 provider_id 는 건너뛴다. 다시 돌리면 위치만 map/좌표로 리셋된다.
-- id 는 명시하지 않는다 — SERIAL 시퀀스 드리프트를 만들지 않기 위해서.

\set ON_ERROR_STOP on
\if :{?count} \else \set count 300 \endif
\if :{?map}   \else \set map 'p001' \endif

BEGIN;

-- 1) account — 없는 것만
INSERT INTO account (provider, provider_id, password)
SELECT 'local',
       'loadtest' || lpad(i::text, 4, '0'),
       '$2b$10$IhLVeWhkjAtcdJyowzAHMe3ZnYByKHYyJTSTvUPR9n.yzEDIP3eDW'
FROM generate_series(1, :count) AS i
ON CONFLICT (provider, provider_id) DO NOTHING;

-- 2) user — account 를 되짚어 붙인다. 좌표는 20×20 격자로 흩뿌린다.
INSERT INTO "user" (account_id, nickname, gender, has_starter, last_map_id, last_x, last_y)
SELECT a.id,
       'lt' || lpad(i::text, 4, '0'),
       CASE WHEN i % 2 = 0 THEN 1 ELSE 2 END,   -- PokemonGender MALE=1 / FEMALE=2
       true,
       :'map',
       40 + (i % 20),
       20 + ((i / 20) % 20)
FROM generate_series(1, :count) AS i
JOIN account a ON a.provider = 'local' AND a.provider_id = 'loadtest' || lpad(i::text, 4, '0')
ON CONFLICT (account_id) DO NOTHING;

-- 3) 코스튬 3종(장착) — 클라이언트 렌더용. 없어도 이동은 되지만 실제 유저와 형태를 맞춘다.
INSERT INTO user_costume (account_id, costume_id, is_equipped)
SELECT u.account_id, c.costume_id, true
FROM "user" u
JOIN account a ON a.id = u.account_id
CROSS JOIN LATERAL (
  VALUES ('skin_0'),
         (CASE WHEN u.gender = 1 THEN 'm_hair_0_c0'   ELSE 'f_hair_0_c0'   END),
         (CASE WHEN u.gender = 1 THEN 'm_outfit_0'    ELSE 'f_outfit_0'    END)
) AS c(costume_id)
WHERE a.provider = 'local' AND a.provider_id LIKE 'loadtest%'
ON CONFLICT (account_id, costume_id) DO NOTHING;

-- 4) safari-ball 30개
INSERT INTO user_item (account_id, item_id, quantity)
SELECT u.account_id, 'safari-ball', 30
FROM "user" u
JOIN account a ON a.id = u.account_id
WHERE a.provider = 'local' AND a.provider_id LIKE 'loadtest%'
ON CONFLICT (account_id, item_id) DO NOTHING;

-- 5) 이미 있던 계정도 이번 회차 기준 위치로 리셋 (직전 회차에서 돌아다녔을 수 있다)
UPDATE "user" u
SET last_map_id = :'map',
    last_x = 40 + (substring(a.provider_id from 9)::int % 20),
    last_y = 20 + ((substring(a.provider_id from 9)::int / 20) % 20)
FROM account a
WHERE a.id = u.account_id
  AND a.provider = 'local'
  AND a.provider_id LIKE 'loadtest%';

COMMIT;

SELECT count(*) AS seeded_accounts
FROM account WHERE provider = 'local' AND provider_id LIKE 'loadtest%';
SELECT last_map_id, count(*) FROM "user" u
JOIN account a ON a.id = u.account_id
WHERE a.provider = 'local' AND a.provider_id LIKE 'loadtest%'
GROUP BY 1;

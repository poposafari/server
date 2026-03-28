-- Migration: user_costume.costume_id integer → varchar(20)
-- Date: 2026-03-28
-- Description: 코스튬 ID를 정수에서 문자열로 변경 (클라이언트 전송값을 그대로 저장)
--
-- ⚠️ 주의: 기존 데이터가 있는 경우 정수값이 문자열로 캐스팅됩니다.
-- 테스트 DB(tmpfs)는 db:push로 자동 반영되므로 이 스크립트 실행 불필요.
-- dev/prod DB에서만 실행하세요.
--
-- 실행 방법: psql -U <user> -d <db> -f drizzle/0001_user_costume_costumeId_to_varchar.sql

-- 1. PK 제약 조건 제거 (composite PK: account_id + costume_id)
ALTER TABLE user_costume DROP CONSTRAINT IF EXISTS user_costume_pkey;

-- 2. costume_id 컬럼 타입 변경
ALTER TABLE user_costume
  ALTER COLUMN costume_id TYPE varchar(20)
  USING costume_id::varchar(20);

-- 3. PK 제약 조건 재생성
ALTER TABLE user_costume ADD PRIMARY KEY (account_id, costume_id);

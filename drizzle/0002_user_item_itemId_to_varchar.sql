-- Migration: user_item.item_id integer → varchar(64)
-- Date: 2026-04-03
-- Description: 아이템 ID를 정수에서 문자열로 변경 ('poke-ball' 등 문자열 ID 저장)
--
-- ⚠️ 주의: 기존 데이터가 있는 경우 정수값이 문자열로 캐스팅됩니다.
-- 테스트 DB(tmpfs)는 db:push로 자동 반영되므로 이 스크립트 실행 불필요.
-- dev/prod DB에서만 실행하세요.
--
-- 실행 방법: psql -U <user> -d <db> -f drizzle/0002_user_item_itemId_to_varchar.sql

-- 1. PK 제약 조건 제거 (composite PK: account_id + item_id)
ALTER TABLE user_item DROP CONSTRAINT IF EXISTS user_item_pkey;

-- 2. item_id 컬럼 타입 변경
ALTER TABLE user_item
  ALTER COLUMN item_id TYPE varchar(64)
  USING item_id::varchar(64);

-- 3. PK 제약 조건 재생성
ALTER TABLE user_item ADD PRIMARY KEY (account_id, item_id);

CREATE SCHEMA IF NOT EXISTS db0;

CREATE TYPE ingame_gender AS ENUM ('boy', 'girl');
CREATE TYPE ingame_avatar AS ENUM ('1', '2', '3', '4');

CREATE TABLE db0.account (
    -- 사용자를 식별하기 위한 값.
    id SERIAL PRIMARY KEY,

    -- 자체_로그인 전용으로 쓸거임.
    username VARCHAR(20) UNIQUE,
    password VARCHAR(100), --평문은 16자 이내로 할 것이지만, 해쉬화 때문에 넉넉하게 100자로.
    email VARCHAR(100),

    -- OAuth 전용으로 쓸거임.
    provider VARCHAR(20),
    provider_id VARCHAR(100),

    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    --provider, provider_id 조합은 중복 불가
    CONSTRAINT uq_provider UNIQUE (provider, provider_id)
);

-- 테이블 생성
CREATE TABLE db0.ingame (
  id SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES db0.account(id) ON DELETE CASCADE,
  location CHAR(3) NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  gender ingame_gender NOT NULL,
  avatar ingame_avatar NOT NULL,
  money INTEGER NOT NULL,
  nickname VARCHAR(10) UNIQUE
);
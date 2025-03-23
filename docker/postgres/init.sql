CREATE SCHEMA IF NOT EXISTS poposafari_default;

CREATE TABLE poposafari_default.account (
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

CREATE TABLE poposafari_default.ingame (
  id SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES poposafari_default.account(id) ON DELETE CASCADE,
  location CHAR(3) NOT NULL,
  x INT NOT NULL,
  y INT NOT NULL,
  gender BOOLEAN NOT NULL,
  avatar SMALLINT NOT NULL,
  nickname VARCHAR(10) NOT NULL
);
CREATE SCHEMA IF NOT EXISTS db0;

CREATE TYPE ingame_gender AS ENUM ('boy', 'girl');
CREATE TYPE ingame_avatar AS ENUM ('1', '2', '3', '4');
CREATE TYPE backgrounds AS ENUM ('0','1', '2', '3', '4', '5', '6', '7', '8', '9', '10','11', '12', '13', '14', '15');

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

CREATE TABLE db0.party_slot(
  id SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES db0.account(id) ON DELETE CASCADE,
  slot1 CHAR(3) NOT NULL DEFAULT '000',
  slot2 CHAR(3) NOT NULL DEFAULT '000',
  slot3 CHAR(3) NOT NULL DEFAULT '000',
  slot4 CHAR(3) NOT NULL DEFAULT '000',
  slot5 CHAR(3) NOT NULL DEFAULT '000',
  slot6 CHAR(3) NOT NULL DEFAULT '000'
);

CREATE TABLE db0.item_slot(
  id SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES db0.account(id) ON DELETE CASCADE,
  slot1 CHAR(3) NULL,
  slot2 CHAR(3) NULL,
  slot3 CHAR(3) NULL,
  slot4 CHAR(3) NULL,
  slot5 CHAR(3) NULL,
  slot6 CHAR(3) NULL,
  slot7 CHAR(3) NULL,
  slot8 CHAR(3) NULL,
  slot9 CHAR(3) NULL
);

CREATE TABLE db0.pokebox_bg(
  id SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES db0.account(id) ON DELETE CASCADE,
  box0 backgrounds NOT NULL DEFAULT '0',
  box1 backgrounds NOT NULL DEFAULT '0',
  box2 backgrounds NOT NULL DEFAULT '0',
  box3 backgrounds NOT NULL DEFAULT '0',
  box4 backgrounds NOT NULL DEFAULT '0',
  box5 backgrounds NOT NULL DEFAULT '0',
  box6 backgrounds NOT NULL DEFAULT '0',
  box7 backgrounds NOT NULL DEFAULT '0',
  box8 backgrounds NOT NULL DEFAULT '0',
  box9 backgrounds NOT NULL DEFAULT '0',
  box10 backgrounds NOT NULL DEFAULT '0',
  box11 backgrounds NOT NULL DEFAULT '0',
  box12 backgrounds NOT NULL DEFAULT '0',
  box13 backgrounds NOT NULL DEFAULT '0',
  box14 backgrounds NOT NULL DEFAULT '0',
  box15 backgrounds NOT NULL DEFAULT '0',
  box16 backgrounds NOT NULL DEFAULT '0',
  box17 backgrounds NOT NULL DEFAULT '0',
  box18 backgrounds NOT NULL DEFAULT '0'
);
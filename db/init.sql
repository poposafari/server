CREATE SCHEMA IF NOT EXISTS db0;

CREATE TYPE ingame_gender AS ENUM ('boy', 'girl');
CREATE TYPE ingame_avatar AS ENUM ('1', '2', '3', '4');
CREATE TYPE backgrounds AS ENUM ('0','1', '2', '3', '4', '5', '6', '7', '8', '9', '10','11', '12', '13', '14', '15');
CREATE TYPE item_type AS ENUM ('pokeball','key','berry','etc');
CREATE TYPE pokemon_gender AS ENUM ('male', 'female', 'none');
CREATE TYPE pokemon_skill AS ENUM ('none','surf', 'dark_eyes');

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

CREATE TABLE db0.ingame (
  account_id INTEGER NOT NULL,
  location CHAR(3) NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  gender ingame_gender NOT NULL,
  avatar ingame_avatar NOT NULL,
  money INTEGER NOT NULL,
  nickname VARCHAR(10) UNIQUE,
  available_ticket INTEGER NOT NULL DEFAULT 8 CHECK (available_ticket >= 0 AND available_ticket <= 8),
  boxes backgrounds[] NOT NULL DEFAULT ARRAY[
    '0','0','0','0','0','0','0','0','0','0', 
    '0','0','0','0','0','0','0','0','0','0',
    '0','0','0','0','0','0','0','0','0','0',
    '0','0','0'
  ]::backgrounds[] CHECK (array_length(boxes, 1) = 33),
  boxes_cnt INTEGER[] NOT NULL DEFAULT ARRAY[
    0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,
    0,0,0
  ]:: INTEGER[] CHECK (array_length(boxes_cnt,1) = 33),
  pet INTEGER NULL,
  party INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[] CHECK (array_length(party, 1) <= 6),
  itemslot CHAR(3)[] NOT NULL DEFAULT ARRAY[]::CHAR(3)[] CHECK (array_length(itemslot, 1) <= 9),
  PRIMARY KEY (account_id),
  FOREIGN KEY (account_id) REFERENCES db0.account(id) ON DELETE CASCADE
);

CREATE TABLE db0.bag(
  account_id INTEGER NOT NULL,
  item CHAR(3) NOT NULL,
  category item_type NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0 AND stock <=999),
  PRIMARY KEY (account_id,item),
  FOREIGN KEY (account_id) REFERENCES db0.account(id) ON DELETE CASCADE
);

CREATE TABLE db0.pokebox(
  idx BIGSERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL,
  pokedex CHAR(4) NOT NULL DEFAULT '0000',
  gender pokemon_gender NOT NULL DEFAULT 'none',
  count INTEGER NOT NULL DEFAULT 1,
  box INTEGER NOT NULL DEFAULT 0 CHECK (box >=0 AND box <=32),
  shiny BOOLEAN NOT NULL DEFAULT FALSE,
  form INTEGER NOT NULL DEFAULT 0,
  skill pokemon_skill[] NOT NULL,
  capture_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  capture_location CHAR(3) NOT NULL DEFAULT '000',
  capture_ball CHAR(3) NOT NULL DEFAULT '001',
  in_party BOOLEAN NOT NULL DEFAULT FALSE,
  nickname VARCHAR(10) NULL,
	FOREIGN KEY (account_id) REFERENCES db0.account(id) ON DELETE CASCADE,
  CONSTRAINT uq_pokebox UNIQUE (account_id, pokedex, gender)
);

CREATE INDEX idx_account_pokebox ON db0.pokebox (account_id, box);

CREATE OR REPLACE FUNCTION update_pokebox_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.box IS DISTINCT FROM OLD.box THEN
    NEW.update_date = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_update_date
BEFORE UPDATE ON db0.pokebox
FOR EACH ROW
EXECUTE FUNCTION update_pokebox_date();
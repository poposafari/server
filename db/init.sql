CREATE SCHEMA IF NOT EXISTS db;

CREATE TYPE social_provider_type AS ENUM ('google', 'discord');
CREATE TYPE ingame_gender AS ENUM ('boy', 'girl');
CREATE TYPE item_category AS ENUM ('pokeball', 'etc', 'berry', 'key');
CREATE TYPE pokemon_gender AS ENUM ('none', 'male', 'female');
CREATE TYPE pokemon_skill AS ENUM ('surf', 'dark_eyes');
CREATE TYPE wild_spawn_type AS ENUM ('water', 'land');

CREATE TABLE db.account (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (now()),
  is_delete BOOLEAN NOT NULL DEFAULT false,
  is_delete_at TIMESTAMPTZ DEFAULT NULL
);

CREATE TABLE db.account_local (
  account_id INTEGER PRIMARY KEY REFERENCES db.account(id) ON DELETE CASCADE,
  username VARCHAR(20) UNIQUE NOT NULL,
  password VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE
);

CREATE TABLE db.account_social (
  provider social_provider_type NOT NULL,
  provider_id VARCHAR(100) NOT NULL,
  account_id INTEGER NOT NULL REFERENCES db.account(id) ON DELETE CASCADE,
  PRIMARY KEY (provider, provider_id)
);

CREATE TABLE db.pc (
  idx SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES db.account(id) ON DELETE CASCADE,
  box INTEGER NOT NULL,
  pokedex VARCHAR(20) NOT NULL,
  gender pokemon_gender NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  friend_ship INTEGER NOT NULL DEFAULT 0 CHECK (friend_ship >= 0 AND friend_ship <= 255),
  region VARCHAR(10) NOT NULL,
  shiny BOOLEAN NOT NULL,
  skill pokemon_skill[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT (now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (now()),
  created_location VARCHAR(4) NOT NULL,
  updated_location VARCHAR(4) NULL,
  created_ball VARCHAR(50) NOT NULL,
  updated_ball VARCHAR(50) NULL,
  nickname VARCHAR(20) DEFAULT ''
);

CREATE TABLE db.bag (
  idx SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES db.account(id) ON DELETE CASCADE,
  item VARCHAR(50) NOT NULL,
  category item_category NOT NULL,
  stock INTEGER NOT NULL DEFAULT 1 CHECK (stock >=0 AND stock <= 999 AND (CASE WHEN category = 'key' THEN stock = 1 ELSE TRUE END))
);

CREATE TABLE db.ingame (
  account_id INTEGER PRIMARY KEY REFERENCES db.account(id) ON DELETE CASCADE,
  nickname VARCHAR(20) UNIQUE NOT NULL,
  x INTEGER NOT NULL DEFAULT 0,
  y INTEGER NOT NULL DEFAULT 0,
  location VARCHAR(4) NOT NULL,
  gender ingame_gender NOT NULL,
  avatar INTEGER NOT NULL CHECK(avatar >= 1 AND avatar <= 4),
  available_ticket INTEGER NOT NULL DEFAULT 4 CHECK (available_ticket >= 0 AND available_ticket <= 4),
  candy INTEGER NOT NULL DEFAULT 0 CHECK (candy >= 0 AND candy <=999999999),
  money INTEGER NOT NULL DEFAULT 0 CHECK (money >= 0 AND money <=999999999),
  party INTEGER[6] DEFAULT ARRAY[NULL, NULL, NULL, NULL, NULL, NULL]::INTEGER[],
  slot_item INTEGER[5] DEFAULT ARRAY[NULL, NULL, NULL, NULL, NULL]::INTEGER[],
  pc_bg INTEGER[33] DEFAULT ARRAY_FILL(0, ARRAY[33])::INTEGER[],
  pc_name VARCHAR(30)[33] DEFAULT ARRAY_FILL(''::VARCHAR, ARRAY[33])::VARCHAR(30)[],
  pc_cnt INTEGER[33] DEFAULT ARRAY_FILL(0, ARRAY[33])::INTEGER[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT (now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (now()),
  playtime INTEGER NOT NULL DEFAULT 0 CHECK (playtime >= 0 AND playtime <= 2147483647),
  discovered_locations VARCHAR(4)[] NOT NULL DEFAULT '{}'::VARCHAR(4)[],
  is_starter_0 BOOLEAN NOT NULL DEFAULT true,
  is_starter_1 BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE db.ingame_option (
  account_id INTEGER PRIMARY KEY REFERENCES db.account(id) ON DELETE CASCADE,
  text_speed INTEGER NOT NULL DEFAULT 1 CHECK(text_speed >=0 AND text_speed <=2),
  frame INTEGER NOT NULL DEFAULT 0 CHECK(frame >=0 AND frame <=10),
  background_volume INTEGER NOT NULL DEFAULT 5 CHECK(background_volume >=0 AND background_volume <=10),
  effect_volume INTEGER NOT NULL DEFAULT 5 CHECK(effect_volume >=0 AND effect_volume <=10),
  tutorial BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE db.ingame_pokedex (
  account_id INTEGER PRIMARY KEY REFERENCES db.account(id) ON DELETE CASCADE,
  gen_1 INTEGER[] NOT NULL DEFAULT '{}'::INTEGER[],
  gen_2 INTEGER[] NOT NULL DEFAULT '{}'::INTEGER[],
  gen_3 INTEGER[] NOT NULL DEFAULT '{}'::INTEGER[],
  gen_4 INTEGER[] NOT NULL DEFAULT '{}'::INTEGER[],
  gen_5 INTEGER[] NOT NULL DEFAULT '{}'::INTEGER[],
  gen_6 INTEGER[] NOT NULL DEFAULT '{}'::INTEGER[],
  gen_7 INTEGER[] NOT NULL DEFAULT '{}'::INTEGER[],
  gen_8 INTEGER[] NOT NULL DEFAULT '{}'::INTEGER[],
  gen_9 INTEGER[] NOT NULL DEFAULT '{}'::INTEGER[]
);

CREATE TABLE db.ingame_costume (
  account_id INTEGER PRIMARY KEY REFERENCES db.account(id) ON DELETE CASCADE,
  skin INTEGER NOT NULL DEFAULT 1,
  eyes INTEGER NOT NULL DEFAULT 1,
  hair INTEGER NOT NULL DEFAULT 1,
  top INTEGER NOT NULL DEFAULT 1,
  bottom INTEGER NOT NULL DEFAULT 1,
  shoes INTEGER NOT NULL DEFAULT 1,
  accessory_0 INTEGER NOT NULL DEFAULT 1,
  accessory_1 INTEGER NOT NULL DEFAULT 1,
  accessory_2 INTEGER NOT NULL DEFAULT 1,
  accessory_3 INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE db.last_wild (
  idx SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES db.account(id) ON DELETE CASCADE,
  location VARCHAR(4) NOT NULL,
  pokedex VARCHAR(20) NOT NULL,
  gender pokemon_gender NOT NULL,
  shiny BOOLEAN NOT NULL,
  region VARCHAR(10) NOT NULL,
  skill pokemon_skill[],
  capture BOOLEAN NOT NULL,
  spawn_type wild_spawn_type NOT NULL,
  eaten_berry VARCHAR(50),
  spawn TIMESTAMPTZ NOT NULL,
  despawn TIMESTAMPTZ NOT NULL
);

CREATE TABLE db.last_grounditem (
  idx SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES db.account(id) ON DELETE CASCADE,
  location VARCHAR(4) NOT NULL,
  item VARCHAR(50) NOT NULL,
  stock INTEGER NOT NULL,
  capture BOOLEAN NOT NULL,
  spawn TIMESTAMPTZ NOT NULL,
  despawn TIMESTAMPTZ NOT NULL
);

CREATE OR REPLACE FUNCTION update_pc_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.box IS DISTINCT FROM OLD.box THEN
    NEW.updated_at = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_update_date
BEFORE UPDATE ON db.pc
FOR EACH ROW
EXECUTE FUNCTION update_pc_date();

CREATE OR REPLACE FUNCTION db.set_is_delete_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_delete = true AND OLD.is_delete = false THEN
    NEW.is_delete_at = now();
  ELSIF NEW.is_delete = false AND OLD.is_delete = true THEN
    NEW.is_delete_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_is_delete_at
BEFORE UPDATE ON db.account
FOR EACH ROW
EXECUTE FUNCTION db.set_is_delete_at();
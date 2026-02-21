-- Poposerver initial schema (from shared/entities)
-- Run once on empty DB (e.g. in postgres container or via psql).
-- Owner: set to your DB user (e.g. postgres or popo from .env.prod DB_USERNAME).

-- Enums (match shared/types/game.type.ts)
CREATE TYPE audit_logs_action_enum AS ENUM (
  'NONE',
  'REGISTER_LOCAL',
  'LOGIN_LOCAL',
  'DELETE_AUTH',
  'LOGOUT',
  'CREATE_USER'
);

CREATE TYPE user_pokemons_gender_enum AS ENUM ('0', '1', '2');

CREATE TYPE user_pokemons_region_enum AS ENUM ('', 'alola', 'galar', 'hisui', 'paldea');

-- Tables (order: auth_identities first, then dependants)
CREATE TABLE IF NOT EXISTS auth_identities (
  id            BIGSERIAL PRIMARY KEY,
  provider      VARCHAR NOT NULL,
  provider_id   VARCHAR NOT NULL,
  password      VARCHAR,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN auth_identities.provider IS '''local'', ''google'', ''discord''';
COMMENT ON COLUMN auth_identities.provider_id IS 'Login ID or Social Sub ID';

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_auth_identities_provider_provider_id"
  ON auth_identities (provider, provider_id);

--

CREATE TABLE IF NOT EXISTS audit_logs (
  id         SERIAL PRIMARY KEY,
  auth_id    BIGINT REFERENCES auth_identities (id) ON DELETE SET NULL,
  action     audit_logs_action_enum NOT NULL,
  detail     JSONB NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--

CREATE TABLE IF NOT EXISTS users (
  auth_id        BIGINT PRIMARY KEY REFERENCES auth_identities (id) ON DELETE CASCADE,
  nickname       VARCHAR(12) NOT NULL UNIQUE,
  money          INTEGER NOT NULL DEFAULT 0,
  candy          INTEGER NOT NULL DEFAULT 0,
  play_time      INTEGER NOT NULL DEFAULT 0,
  is_newbie      BOOLEAN NOT NULL DEFAULT TRUE,
  gender         VARCHAR NOT NULL,
  last_location  JSONB,
  last_costume   JSONB NOT NULL DEFAULT '{}'::JSONB,
  last_party     BIGINT[] NOT NULL DEFAULT '{}'::BIGINT[],
  last_quickslot BIGINT[] NOT NULL DEFAULT '{}'::BIGINT[],
  last_townmap   VARCHAR[] NOT NULL DEFAULT '{}'::VARCHAR[],
  pc_settings    JSONB NOT NULL DEFAULT '{"background": [], "name": []}'::JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN users.nickname IS '인게임 표시용 닉네임';
COMMENT ON COLUMN users.last_party IS '사용자가 데리고 다니는 포켓몬(user_pokemons)의 ID 목록';
COMMENT ON COLUMN users.last_quickslot IS '퀵슬롯에 등록된 아이템/도구 고유 ID 목록';
COMMENT ON COLUMN users.pc_settings IS 'PC 박스 배경 및 이름 설정';

--

CREATE TABLE IF NOT EXISTS user_bags (
  id       BIGSERIAL PRIMARY KEY,
  auth_id  BIGINT NOT NULL REFERENCES auth_identities (id) ON DELETE CASCADE,
  item_id  VARCHAR NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1 AND quantity <= 999)
);

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_bags_auth_id_item_id"
  ON user_bags (auth_id, item_id);

--

CREATE TABLE IF NOT EXISTS user_costumes (
  id         BIGSERIAL PRIMARY KEY,
  auth_id    BIGINT NOT NULL REFERENCES auth_identities (id) ON DELETE CASCADE,
  costume_id VARCHAR NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_costumes_auth_id_costume_id"
  ON user_costumes (auth_id, costume_id);

--

CREATE TABLE IF NOT EXISTS user_pokemons (
  id             BIGSERIAL PRIMARY KEY,
  auth_id        BIGINT NOT NULL REFERENCES auth_identities (id) ON DELETE CASCADE,
  pokemon_id     VARCHAR NOT NULL,
  box            INTEGER NOT NULL,
  slot           INTEGER NOT NULL,
  gender         user_pokemons_gender_enum NOT NULL DEFAULT '0'::user_pokemons_gender_enum,
  region         user_pokemons_region_enum NOT NULL DEFAULT ''::user_pokemons_region_enum,
  form           VARCHAR,
  held           VARCHAR,
  catch_count    INTEGER NOT NULL DEFAULT 1 CHECK (catch_count >= 1 AND catch_count <= 999999999),
  friend_ship    INTEGER NOT NULL DEFAULT 0 CHECK (friend_ship >= 0 AND friend_ship <= 255),
  shiny          BOOLEAN NOT NULL,
  entered_box_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN user_pokemons.pokemon_id IS '포켓몬 도감 번호';
COMMENT ON COLUMN user_pokemons.box IS '박스 번호';
COMMENT ON COLUMN user_pokemons.slot IS '박스 내 순서(슬롯)';
COMMENT ON COLUMN user_pokemons.gender IS '0=NONE, 1=MALE, 2=FEMALE';
COMMENT ON COLUMN user_pokemons.region IS '리전폼 타입';
COMMENT ON COLUMN user_pokemons.form IS '무슨 폼인지(ex.메가진화, 거다이맥스 등)';
COMMENT ON COLUMN user_pokemons.held IS '지니고 있는 아이템';
COMMENT ON COLUMN user_pokemons.catch_count IS '포획한 횟수';
COMMENT ON COLUMN user_pokemons.entered_box_at IS '해당 박스로 이동하거나 처음 잡은 시간 (정렬 기준)';

CREATE INDEX IF NOT EXISTS idx_perf_user_box ON user_pokemons (auth_id, box);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_pokemon_gender ON user_pokemons (auth_id, pokemon_id, gender);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_box_slot ON user_pokemons (auth_id, box, slot);

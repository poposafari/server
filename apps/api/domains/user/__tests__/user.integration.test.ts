import { FastifyInstance } from 'fastify';
import { buildApp } from 'apps/api/app';
import { db } from '@poposerver/lib/db';
import { connectDB } from '@poposerver/lib/db';
import { RedisClient, connectRedis } from '@poposerver/lib/redis';
import {
  account,
  user,
  userCostume,
  userPokemon,
  userItem,
  userPokedex,
  userTownMap,
} from '@poposerver/lib/schema';
import { eq, sql } from 'drizzle-orm';

let app: FastifyInstance;

beforeAll(async () => {
  await connectDB('TEST');
  await connectRedis(RedisClient, 'TEST');
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await RedisClient.quit();
});

/** 테스트 간 격리 */
afterEach(async () => {
  // 자식 테이블 먼저 삭제 (FK 제약)
  await db.execute(
    sql`DELETE FROM user_town_map WHERE account_id IN (SELECT id FROM account WHERE provider = 'local')`,
  );
  await db.execute(
    sql`DELETE FROM user_pokedex WHERE account_id IN (SELECT id FROM account WHERE provider = 'local')`,
  );
  await db.execute(
    sql`DELETE FROM user_item WHERE account_id IN (SELECT id FROM account WHERE provider = 'local')`,
  );
  await db.execute(
    sql`DELETE FROM user_pokemon WHERE account_id IN (SELECT id FROM account WHERE provider = 'local')`,
  );
  await db.execute(
    sql`DELETE FROM user_costume WHERE account_id IN (SELECT id FROM account WHERE provider = 'local')`,
  );
  await db.execute(
    sql`DELETE FROM "user" WHERE account_id IN (SELECT id FROM account WHERE provider = 'local')`,
  );
  await db.delete(account).where(eq(account.provider, 'local'));

  const sessionKeys = await RedisClient.keys('session:*');
  if (sessionKeys.length > 0) await RedisClient.del(...sessionKeys);
  const stateKeys = await RedisClient.keys('user:*:state');
  if (stateKeys.length > 0) await RedisClient.del(...stateKeys);
});

// ── 헬퍼 ──

function extractSidCookie(res: Awaited<ReturnType<FastifyInstance['inject']>>): string | undefined {
  const setCookie = res.headers['set-cookie'];
  const cookieStr = Array.isArray(setCookie)
    ? setCookie.find((c) => c.startsWith('sid='))
    : setCookie;
  if (!cookieStr) return undefined;
  const match = cookieStr.match(/sid=([^;]+)/);
  return match?.[1];
}

const validUser = { username: 'testuser1', password: 'Test1234!' };

/** 회원가입 → 로그인 → sid + authId 반환 */
async function registerAndLogin(): Promise<{ sid: string; authId: number }> {
  await app.inject({
    method: 'POST',
    url: '/api/auth/register/local',
    payload: validUser,
  });

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login/local',
    payload: validUser,
  });
  const sid = extractSidCookie(loginRes)!;

  // account에서 authId 조회
  const [acc] = await db
    .select({ id: account.id })
    .from(account)
    .where(eq(account.providerId, validUser.username))
    .limit(1);

  return { sid, authId: acc.id };
}

/** user 테이블에 캐릭터 생성 */
async function createUserProfile(accountId: number) {
  await db.insert(user).values({
    accountId,
    nickname: 'testnick',
    gender: 0,
    lastMapId: 'p001',
    lastX: 37,
    lastY: 32,
  });
}

/** 테스트용 시드 데이터 삽입 */
async function seedGameData(accountId: number) {
  // 착용 코스튬
  await db.insert(userCostume).values([
    { accountId, costumeId: 'skin_0', isEquipped: true },
    { accountId, costumeId: 'm_hair_0_c0', isEquipped: true },
    { accountId, costumeId: 'm_outfit_0', isEquipped: false },
  ]);

  // 파티 포켓몬 (partySlot != null)
  await db.insert(userPokemon).values([
    {
      accountId,
      pokedexId: 25,
      level: 10,
      gender: 0,
      isShiny: false,
      abilityId: 1,
      natureId: 1,
      skills: [1, 2],
      partySlot: 0,
      ballId: 1,
      caughtLocation: 's001',
    },
    {
      accountId,
      pokedexId: 1,
      level: 5,
      gender: 1,
      isShiny: false,
      abilityId: 2,
      natureId: 3,
      skills: [3],
      partySlot: 1,
      ballId: 1,
      caughtLocation: 's001',
    },
  ]);

  // PC 박스 포켓몬 (partySlot IS NULL)
  await db.insert(userPokemon).values([
    {
      accountId,
      pokedexId: 4,
      level: 8,
      gender: 0,
      isShiny: true,
      abilityId: 1,
      natureId: 2,
      skills: [4, 5],
      partySlot: null,
      boxNumber: 1,
      gridNumber: 0,
      ballId: 2,
      caughtLocation: 's002',
    },
  ]);

  // 단축 슬롯 아이템 (slotNumber != null)
  await db.insert(userItem).values([
    { accountId, itemId: 1, quantity: 10, slotNumber: 0 },
    { accountId, itemId: 2, quantity: 5, slotNumber: 1 },
  ]);

  // 가방 아이템 (slotNumber IS NULL)
  await db.insert(userItem).values([{ accountId, itemId: 3, quantity: 20, slotNumber: null }]);

  // 도감
  await db.insert(userPokedex).values([
    { accountId, pokedexId: 25, caughtCount: 3 },
    { accountId, pokedexId: 1, caughtCount: 1 },
  ]);

  // 타운맵
  await db.insert(userTownMap).values([
    { accountId, mapId: 1 },
    { accountId, mapId: 2 },
  ]);
}

// ── 아바타 생성 API ──

const validCreateUserPayload = {
  nickname: 'Player1',
  gender: 'male',
  costume: {
    skin: 'skin_0',
    hair: 'hair_0_c0',
    outfit: 'outfit_0',
  },
};

describe('POST /api/user/create', () => {
  it('성공 → 201 + user/userCostume DB 확인 (코스튬 3건)', async () => {
    const { sid, authId } = await registerAndLogin();

    const res = await app.inject({
      method: 'POST',
      url: '/api/user/create',
      cookies: { sid },
      payload: validCreateUserPayload,
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ success: true, data: null });

    // user 테이블 확인
    const [created] = await db
      .select()
      .from(user)
      .where(eq(user.accountId, authId));
    expect(created.nickname).toBe('Player1');
    expect(created.gender).toBe(1); // male → PokemonGender.MALE
    expect(created.lastMapId).toBe('p001');
    expect(created.lastX).toBe(37);
    expect(created.lastY).toBe(32);

    // userCostume 테이블 확인 (3건)
    const costumes = await db
      .select()
      .from(userCostume)
      .where(eq(userCostume.accountId, authId));
    expect(costumes).toHaveLength(3);

    const costumeIds = costumes.map((c) => c.costumeId).sort();
    expect(costumeIds).toEqual(['m_hair_0_c0', 'm_outfit_0', 'skin_0']);
    expect(costumes.every((c) => c.isEquipped)).toBe(true);
  });

  it('닉네임 중복 → 409 NICKNAME_ALREADY_EXISTS', async () => {
    const { sid: sid1, authId: authId1 } = await registerAndLogin();

    // 첫 번째 유저 생성
    await app.inject({
      method: 'POST',
      url: '/api/user/create',
      cookies: { sid: sid1 },
      payload: validCreateUserPayload,
    });

    // 두 번째 계정 생성
    const user2 = { username: 'testuser2', password: 'Test1234!' };
    await app.inject({
      method: 'POST',
      url: '/api/auth/register/local',
      payload: user2,
    });
    const loginRes2 = await app.inject({
      method: 'POST',
      url: '/api/auth/login/local',
      payload: user2,
    });
    const sid2 = extractSidCookie(loginRes2)!;

    const res = await app.inject({
      method: 'POST',
      url: '/api/user/create',
      cookies: { sid: sid2 },
      payload: { ...validCreateUserPayload, nickname: 'Player1' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('NICKNAME_ALREADY_EXISTS');
  });

  it('캐릭터 이미 존재 → 409 USER_ALREADY_EXISTS', async () => {
    const { sid } = await registerAndLogin();

    await app.inject({
      method: 'POST',
      url: '/api/user/create',
      cookies: { sid },
      payload: validCreateUserPayload,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/user/create',
      cookies: { sid },
      payload: { ...validCreateUserPayload, nickname: 'DiffNick' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('USER_ALREADY_EXISTS');
  });

  it('잘못된 닉네임 형식 → 400 DTO_INVALID', async () => {
    const { sid } = await registerAndLogin();

    const res = await app.inject({
      method: 'POST',
      url: '/api/user/create',
      cookies: { sid },
      payload: { ...validCreateUserPayload, nickname: '!!invalid!!' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('DTO_INVALID');
  });

  it('잘못된 코스튬 형식 → 400 DTO_INVALID', async () => {
    const { sid } = await registerAndLogin();

    const res = await app.inject({
      method: 'POST',
      url: '/api/user/create',
      cookies: { sid },
      payload: {
        ...validCreateUserPayload,
        costume: { skin: 'bad', hair: 'bad', outfit: 'bad' },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('DTO_INVALID');
  });

  it('인증 없이 요청 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/user/create',
      payload: validCreateUserPayload,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ── 게임 진입 API ──

describe('GET /api/user/me', () => {
  it('게임 진입 성공 → 200 + profile/party/costume/itemSlots + Redis state 생성', async () => {
    const { sid, authId } = await registerAndLogin();
    await createUserProfile(authId);
    await seedGameData(authId);

    const res = await app.inject({
      method: 'GET',
      url: '/api/user/me',
      cookies: { sid },
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.success).toBe(true);

    // profile
    expect(body.data.profile.nickname).toBe('testnick');
    expect(body.data.profile.gender).toBe(0);
    expect(body.data.profile.lastMapId).toBe('p001');

    // 착용 코스튬 (isEquipped=true만)
    expect(body.data.equippedCostumes).toHaveLength(2);

    // 파티 포켓몬 (partySlot != null)
    expect(body.data.party).toHaveLength(2);
    expect(body.data.party[0].pokedexId).toBe(25);
    expect(body.data.party[1].pokedexId).toBe(1);

    // 단축 슬롯 아이템 (slotNumber != null)
    expect(body.data.itemSlots).toHaveLength(2);

    // Redis state 생성 확인
    const state = await RedisClient.hgetall(`user:${authId}:state`);
    expect(state.nickname).toBe('testnick');
    expect(state.mapId).toBe('1');
    expect(state.party).toBeDefined();
    expect(JSON.parse(state.party)).toHaveLength(2);
    expect(state.itemSlots).toBeDefined();
    expect(JSON.parse(state.itemSlots)).toHaveLength(2);
    expect(state.costume).toBeDefined();
    expect(JSON.parse(state.costume)).toHaveLength(2);
  });

  it('캐릭터 미생성 (user 테이블 없음) → 404 USER_NOT_FOUND', async () => {
    const { sid } = await registerAndLogin();

    const res = await app.inject({
      method: 'GET',
      url: '/api/user/me',
      cookies: { sid },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('USER_NOT_FOUND');
  });

  it('인증 없이 요청 → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/user/me',
    });

    expect(res.statusCode).toBe(401);
  });
});

// ── Lazy Load: PC 박스 ──

describe('GET /api/pokemon/box', () => {
  it('PC 박스 포켓몬 조회 → partySlot IS NULL인 포켓몬만 반환', async () => {
    const { sid, authId } = await registerAndLogin();
    await createUserProfile(authId);
    await seedGameData(authId);

    const res = await app.inject({
      method: 'GET',
      url: '/api/pokemon/box',
      cookies: { sid },
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].pokedexId).toBe(4);
    expect(body.data[0].isShiny).toBe(true);
    expect(body.data[0].boxNumber).toBe(1);
  });

  it('데이터 없음 → 빈 배열', async () => {
    const { sid, authId } = await registerAndLogin();
    await createUserProfile(authId);

    const res = await app.inject({
      method: 'GET',
      url: '/api/pokemon/box',
      cookies: { sid },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });
});

// ── Lazy Load: 가방 ──

describe('GET /api/item/bag', () => {
  it('가방 아이템 조회 → slotNumber IS NULL인 아이템만 반환', async () => {
    const { sid, authId } = await registerAndLogin();
    await createUserProfile(authId);
    await seedGameData(authId);

    const res = await app.inject({
      method: 'GET',
      url: '/api/item/bag',
      cookies: { sid },
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].itemId).toBe(3);
    expect(body.data[0].quantity).toBe(20);
  });
});

// ── Lazy Load: 도감 ──

describe('GET /api/pokedex', () => {
  it('도감 조회 → 전체 도감 데이터 반환', async () => {
    const { sid, authId } = await registerAndLogin();
    await createUserProfile(authId);
    await seedGameData(authId);

    const res = await app.inject({
      method: 'GET',
      url: '/api/pokedex',
      cookies: { sid },
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].pokedexId).toBe(1);
    expect(body.data[1].pokedexId).toBe(25);
  });
});

// ── Lazy Load: 타운맵 ──

describe('GET /api/town-map', () => {
  it('타운맵 조회 → 방문한 맵 목록 반환', async () => {
    const { sid, authId } = await registerAndLogin();
    await createUserProfile(authId);
    await seedGameData(authId);

    const res = await app.inject({
      method: 'GET',
      url: '/api/town-map',
      cookies: { sid },
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].mapId).toBe(1);
    expect(body.data[1].mapId).toBe(2);
  });
});

// ── Lazy Load: 코스튬 ──

describe('GET /api/costume', () => {
  it('코스튬 전체 조회 → isEquipped 포함 전체 반환', async () => {
    const { sid, authId } = await registerAndLogin();
    await createUserProfile(authId);
    await seedGameData(authId);

    const res = await app.inject({
      method: 'GET',
      url: '/api/costume',
      cookies: { sid },
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(3);

    const equipped = body.data.filter((c: { isEquipped: boolean }) => c.isEquipped);
    const unequipped = body.data.filter((c: { isEquipped: boolean }) => !c.isEquipped);
    expect(equipped).toHaveLength(2);
    expect(unequipped).toHaveLength(1);
  });
});

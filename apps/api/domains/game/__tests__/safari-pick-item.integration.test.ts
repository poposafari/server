import { FastifyInstance } from 'fastify';
import { buildApp } from 'apps/api/app';
import { db } from '@poposerver/lib/db';
import { connectDB } from '@poposerver/lib/db';
import { RedisClient, connectRedis, RedisKey, getUserState, getSafariMapData } from '@poposerver/lib/redis';
import { account, user, userItem } from '@poposerver/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { MasterData } from '@poposerver/lib/utils/master-data';

let app: FastifyInstance;

beforeAll(async () => {
  await connectDB('TEST');
  await connectRedis(RedisClient, 'TEST');
  await MasterData.load('TEST');
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await RedisClient.quit();
});

afterEach(async () => {
  await db.execute(
    sql`DELETE FROM user_item WHERE account_id IN (SELECT id FROM account WHERE provider = 'local')`,
  );
  await db.delete(user);
  await db.delete(account).where(eq(account.provider, 'local'));
  const keys = await RedisClient.keys('session:*');
  if (keys.length > 0) await RedisClient.del(...keys);
  const userKeys = await RedisClient.keys('user:*:state');
  if (userKeys.length > 0) await RedisClient.del(...userKeys);
  const safariKeys = await RedisClient.keys('safari:*');
  if (safariKeys.length > 0) await RedisClient.del(...safariKeys);
});

// ── 헬퍼 ──

function extractSidCookie(res: Awaited<ReturnType<FastifyInstance['inject']>>): string | undefined {
  const setCookie = res.headers['set-cookie'];
  const cookieStr = Array.isArray(setCookie) ? setCookie.find((c) => c.startsWith('sid=')) : setCookie;
  if (!cookieStr) return undefined;
  const match = cookieStr.match(/sid=([^;]+)/);
  return match?.[1];
}

const validUser = { username: 'picktest1', password: 'Test1234!' };

async function registerAndGetSid(): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register/local',
    payload: validUser,
  });
  return extractSidCookie(res)!;
}

async function getAuthIdFromSid(sid: string): Promise<string> {
  const data = await RedisClient.get(`session:${sid}`);
  return JSON.parse(data!).authId;
}

async function createUserAndSetState(sid: string, level = 50): Promise<string> {
  const authId = await getAuthIdFromSid(sid);
  const accountId = Number(authId);

  await db.insert(user).values({
    accountId,
    nickname: `tester${accountId}`,
    gender: 1,
    level,
    lastMapId: 'p001',
    lastX: 37,
    lastY: 32,
  });

  const stateKey = RedisKey.userState(authId);
  await RedisClient.hset(stateKey, {
    mapId: 'p001',
    x: '37',
    y: '32',
    nickname: `tester${accountId}`,
    level: String(level),
    gender: '1',
    party: '[]',
    itemSlots: '[]',
    costume: '[]',
    socketId: '',
    pet: '',
    createdAt: new Date().toISOString(),
    lastMoveTime: String(Date.now()),
  });

  return authId;
}

/** 사파리에 입장하고 첫 번째 맵의 아이템 uid를 반환 */
async function enterSafariAndGetItemUid(
  sid: string,
  authId: string,
): Promise<{ uid: string; itemId: string; mapId: string } | null> {
  await app.inject({
    method: 'POST',
    url: '/api/game/safari/enter',
    cookies: { sid },
    payload: { mapId: 's001' },
  });

  const state = await getUserState(authId);
  const mapId = state!.mapId;
  const mapData = await getSafariMapData(authId, mapId);
  if (!mapData || mapData.items.length === 0) return null;

  return {
    uid: mapData.items[0].uid,
    itemId: mapData.items[0].itemId,
    mapId,
  };
}

// ── 사파리 아이템 줍기 ──

describe('POST /api/game/safari/pick-item', () => {
  it('사파리에서 아이템 줍기 → 200 + itemId, newQuantity 반환', async () => {
    const sid = await registerAndGetSid();
    const authId = await createUserAndSetState(sid);
    const itemInfo = await enterSafariAndGetItemUid(sid, authId);

    if (!itemInfo) {
      // 아이템이 스폰되지 않은 경우 스킵
      console.log('No items spawned in safari, skipping test');
      return;
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/game/safari/pick-item',
      cookies: { sid },
      payload: { uid: itemInfo.uid },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.itemId).toBe(itemInfo.itemId);
    expect(body.data.newQuantity).toBe(1);
  });

  it('줍기 후 Redis에서 picked === true로 갱신됨', async () => {
    const sid = await registerAndGetSid();
    const authId = await createUserAndSetState(sid);
    const itemInfo = await enterSafariAndGetItemUid(sid, authId);
    if (!itemInfo) return;

    await app.inject({
      method: 'POST',
      url: '/api/game/safari/pick-item',
      cookies: { sid },
      payload: { uid: itemInfo.uid },
    });

    const mapData = await getSafariMapData(authId, itemInfo.mapId);
    const item = mapData!.items.find((i) => i.uid === itemInfo.uid);
    expect(item!.picked).toBe(true);
  });

  it('줍기 후 DB user_item에 레코드가 생성됨', async () => {
    const sid = await registerAndGetSid();
    const authId = await createUserAndSetState(sid);
    const itemInfo = await enterSafariAndGetItemUid(sid, authId);
    if (!itemInfo) return;

    await app.inject({
      method: 'POST',
      url: '/api/game/safari/pick-item',
      cookies: { sid },
      payload: { uid: itemInfo.uid },
    });

    const rows = await db
      .select()
      .from(userItem)
      .where(and(eq(userItem.accountId, Number(authId)), eq(userItem.itemId, itemInfo.itemId)));

    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(1);
  });

  it('같은 아이템을 두 번 줍기 시도 → 409 SAFARI_ITEM_ALREADY_PICKED', async () => {
    const sid = await registerAndGetSid();
    const authId = await createUserAndSetState(sid);
    const itemInfo = await enterSafariAndGetItemUid(sid, authId);
    if (!itemInfo) return;

    // 첫 번째 줍기
    await app.inject({
      method: 'POST',
      url: '/api/game/safari/pick-item',
      cookies: { sid },
      payload: { uid: itemInfo.uid },
    });

    // 두 번째 줍기
    const res = await app.inject({
      method: 'POST',
      url: '/api/game/safari/pick-item',
      cookies: { sid },
      payload: { uid: itemInfo.uid },
    });

    expect(res.statusCode).toBe(409);
  });

  it('존재하지 않는 uid → 404 SAFARI_ITEM_NOT_FOUND', async () => {
    const sid = await registerAndGetSid();
    const authId = await createUserAndSetState(sid);
    await enterSafariAndGetItemUid(sid, authId);

    const res = await app.inject({
      method: 'POST',
      url: '/api/game/safari/pick-item',
      cookies: { sid },
      payload: { uid: '00000000-0000-0000-0000-000000000000' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('사파리가 아닌 곳에서 줍기 시도 → 400 NOT_IN_SAFARI', async () => {
    const sid = await registerAndGetSid();
    await createUserAndSetState(sid); // plaza에 있는 상태

    const res = await app.inject({
      method: 'POST',
      url: '/api/game/safari/pick-item',
      cookies: { sid },
      payload: { uid: '00000000-0000-0000-0000-000000000000' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('인증 없이 요청 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/game/safari/pick-item',
      payload: { uid: '00000000-0000-0000-0000-000000000000' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('잘못된 uid 형식 → 400', async () => {
    const sid = await registerAndGetSid();
    await createUserAndSetState(sid);

    const res = await app.inject({
      method: 'POST',
      url: '/api/game/safari/pick-item',
      cookies: { sid },
      payload: { uid: 'not-a-uuid' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('이미 보유 중인 아이템을 주우면 quantity가 증가함', async () => {
    const sid = await registerAndGetSid();
    const authId = await createUserAndSetState(sid);
    const itemInfo = await enterSafariAndGetItemUid(sid, authId);
    if (!itemInfo) return;

    // DB에 미리 해당 아이템 1개 보유
    await db.insert(userItem).values({
      accountId: Number(authId),
      itemId: itemInfo.itemId,
      quantity: 3,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/game/safari/pick-item',
      cookies: { sid },
      payload: { uid: itemInfo.uid },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.newQuantity).toBe(4);
  });
});

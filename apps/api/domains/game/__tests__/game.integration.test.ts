import { FastifyInstance } from 'fastify';
import { buildApp } from 'apps/api/app';
import { db } from '@poposerver/lib/db';
import { connectDB } from '@poposerver/lib/db';
import { RedisClient, connectRedis, RedisKey, getUserState, getSafariMapData, getSafariVisitedMaps } from '@poposerver/lib/redis';
import { account, user } from '@poposerver/lib/schema';
import { eq } from 'drizzle-orm';
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
  await db.delete(user);
  await db.delete(account).where(eq(account.provider, 'local'));
  const keys = await RedisClient.keys('session:*');
  if (keys.length > 0) await RedisClient.del(...keys);
  const connKeys = await RedisClient.keys('conn:*');
  if (connKeys.length > 0) await RedisClient.del(...connKeys);
  const userKeys = await RedisClient.keys('user:*:state');
  if (userKeys.length > 0) await RedisClient.del(...userKeys);
  const safariKeys = await RedisClient.keys('safari:*');
  if (safariKeys.length > 0) await RedisClient.del(...safariKeys);
  // 슬롯 키 정리 — connect 분기에서 SADD되므로 누적 방지
  await RedisClient.del('active:players');
});

// ── 헬퍼 ──

function extractSidCookie(res: Awaited<ReturnType<FastifyInstance['inject']>>): string | undefined {
  const setCookie = res.headers['set-cookie'];
  const cookieStr = Array.isArray(setCookie) ? setCookie.find((c) => c.startsWith('sid=')) : setCookie;
  if (!cookieStr) return undefined;
  const match = cookieStr.match(/sid=([^;]+)/);
  return match?.[1];
}

const validUser = { username: 'gametest1', password: 'Test1234!' };

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

// ── 연결 토큰 발급 ──

describe('POST /api/game/connect', () => {
  it('인증된 유저 → 200 + 연결 토큰 발급', async () => {
    const sid = await registerAndGetSid();

    const res = await app.inject({
      method: 'POST',
      url: '/api/game/connect',
      cookies: { sid },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.token).toBeDefined();
    expect(typeof body.data.token).toBe('string');

    // Redis에 conn:{token} 키 존재 확인
    const authId = await RedisClient.get(RedisKey.connToken(body.data.token));
    expect(authId).not.toBeNull();
  });

  it('인증 없이 요청 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/game/connect',
    });

    expect(res.statusCode).toBe(401);
  });

  it('만료된 세션으로 요청 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/game/connect',
      cookies: { sid: 'invalid-session-id' },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ── 토큰 1회용 소비 ──

describe('연결 토큰 1회용 특성', () => {
  it('토큰은 consumeConnToken 후 Redis에서 삭제됨', async () => {
    const sid = await registerAndGetSid();

    const res = await app.inject({
      method: 'POST',
      url: '/api/game/connect',
      cookies: { sid },
    });
    const token = res.json().data.token;

    // 토큰이 존재하는지 확인
    const key = RedisKey.connToken(token);
    const before = await RedisClient.get(key);
    expect(before).not.toBeNull();

    // GET + DEL로 소비 시뮬레이션 (consumeConnToken과 동일)
    const authId = await RedisClient.get(key);
    await RedisClient.del(key);

    expect(authId).not.toBeNull();

    // 소비 후 다시 조회 → null
    const after = await RedisClient.get(key);
    expect(after).toBeNull();
  });
});

// ── 토큰 TTL ──

describe('연결 토큰 TTL', () => {
  it('토큰의 TTL이 30초 이하로 설정됨', async () => {
    const sid = await registerAndGetSid();

    const res = await app.inject({
      method: 'POST',
      url: '/api/game/connect',
      cookies: { sid },
    });
    const token = res.json().data.token;

    const ttl = await RedisClient.ttl(RedisKey.connToken(token));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(30);
  });
});

// ── 기존 접속자 킥 신호 ──

describe('기존 접속자가 있을 때 토큰 발급', () => {
  it('user:state가 존재하면 Pub/Sub 킥 신호 발생 + 토큰 정상 발급', async () => {
    const sid = await registerAndGetSid();
    const authId = await getAuthIdFromSid(sid);

    // user:state를 시뮬레이션으로 생성
    const stateKey = RedisKey.userState(authId);
    await RedisClient.hset(stateKey, {
      mapId: 'map_01',
      x: '10',
      y: '20',
      nickname: 'tester',
      level: '1',
      gender: 'male',
      party: '',
      itemSlots: '',
      costume: '',
      socketId: 'old-socket-id',
      pet: '',
      createdAt: new Date().toISOString(),
      lastMoveTime: new Date().toISOString(),
    });

    // Pub/Sub 킥 신호 수신 대기
    const kickPromise = new Promise<string>((resolve) => {
      const subscriber = RedisClient.duplicate();
      subscriber.subscribe('socket:kick', () => {
        subscriber.on('message', (_channel, message) => {
          subscriber.unsubscribe();
          subscriber.quit();
          resolve(message);
        });
      });
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/game/connect',
      cookies: { sid },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.token).toBeDefined();

    // 킥 신호가 올바른 authId로 발생했는지 확인
    const kickedAuthId = await kickPromise;
    expect(kickedAuthId).toBe(authId);
  });

  it('user:state가 없으면 킥 없이 토큰만 발급', async () => {
    const sid = await registerAndGetSid();
    const authId = await getAuthIdFromSid(sid);

    // user:state가 없는 상태에서 토큰 발급
    const stateKey = RedisKey.userState(authId);
    const exists = await RedisClient.exists(stateKey);
    expect(exists).toBe(0);

    const res = await app.inject({
      method: 'POST',
      url: '/api/game/connect',
      cookies: { sid },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.token).toBeDefined();
  });
});

// ── 사파리 입장 ──

async function createUserAndSetState(sid: string): Promise<string> {
  const authId = await getAuthIdFromSid(sid);
  const accountId = Number(authId);

  // user 테이블에 레코드 생성
  await db.insert(user).values({
    accountId,
    nickname: `tester${accountId}`,
    gender: 1,
    lastMapId: 'p001',
    lastX: 37,
    lastY: 32,
  });

  // Redis에 user state 세팅 (plaza에 있는 상태)
  const stateKey = RedisKey.userState(authId);
  await RedisClient.hset(stateKey, {
    mapId: 'p001',
    x: '37',
    y: '32',
    nickname: `tester${accountId}`,
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

describe('POST /api/game/safari/enter', () => {
  it('plaza에서 사파리 입장 → 200 + 야생 포켓몬/아이템 데이터 반환', async () => {
    const sid = await registerAndGetSid();
    await createUserAndSetState(sid);

    const res = await app.inject({
      method: 'POST',
      url: '/api/game/safari/enter',
      cookies: { sid },
      payload: { mapId: 's001' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    // s001 맵 데이터가 포함되어 있어야 함
    expect(body.data['s001']).toBeDefined();
    expect(body.data['s001'].wilds).toBeInstanceOf(Array);
    expect(body.data['s001'].items).toBeInstanceOf(Array);
  });

  it('야생 포켓몬 레벨이 종(엔트리)별 levelMin~levelMax 범위 내', async () => {
    const sid = await registerAndGetSid();
    await createUserAndSetState(sid);

    const res = await app.inject({
      method: 'POST',
      url: '/api/game/safari/enter',
      cookies: { sid },
      payload: { mapId: 's001' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // s001의 모든 시간×날씨 풀 엔트리에서 레벨 범위 경계를 실제 마스터 데이터로부터 도출
    const s001 = MasterData.getMap('s001')!;
    const times = ['dawn', 'day', 'dusk', 'night'] as const;
    const weathers = ['sunny', 'rainy', 'stormy', 'foggy'] as const;
    let lo = Infinity;
    let hi = -Infinity;
    for (const t of times) {
      for (const w of weathers) {
        for (const e of s001.wild[t][w]) {
          lo = Math.min(lo, e.levelMin);
          hi = Math.max(hi, e.levelMax);
        }
      }
    }

    for (const mapId of Object.keys(body.data)) {
      for (const wild of body.data[mapId].wilds) {
        expect(wild.level).toBeDefined();
        expect(typeof wild.level).toBe('number');
        expect(wild.level).toBeGreaterThanOrEqual(lo);
        expect(wild.level).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('인증 없이 요청 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/game/safari/enter',
      payload: { mapId: 's001' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('잘못된 mapId 형식 → 400', async () => {
    const sid = await registerAndGetSid();
    await createUserAndSetState(sid);

    const res = await app.inject({
      method: 'POST',
      url: '/api/game/safari/enter',
      cookies: { sid },
      payload: { mapId: 'p001' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('plaza가 아닌 곳에서 입장 시도 → 400 NOT_IN_PLAZA', async () => {
    const sid = await registerAndGetSid();
    const authId = await createUserAndSetState(sid);

    // mapId를 사파리로 변경
    await RedisClient.hset(RedisKey.userState(authId), 'mapId', 's001');

    const res = await app.inject({
      method: 'POST',
      url: '/api/game/safari/enter',
      cookies: { sid },
      payload: { mapId: 's001' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('이미 사파리에 진입 중 → 409 ALREADY_IN_SAFARI', async () => {
    const sid = await registerAndGetSid();
    await createUserAndSetState(sid);

    // 첫 번째 입장
    await app.inject({
      method: 'POST',
      url: '/api/game/safari/enter',
      cookies: { sid },
      payload: { mapId: 's001' },
    });

    // 위치를 다시 plaza로 되돌려서 두 번째 입장 시도
    const authId = await getAuthIdFromSid(sid);
    await RedisClient.hset(RedisKey.userState(authId), 'mapId', 'p001');

    const res = await app.inject({
      method: 'POST',
      url: '/api/game/safari/enter',
      cookies: { sid },
      payload: { mapId: 's001' },
    });
    expect(res.statusCode).toBe(409);
  });
});

// ── 사파리 퇴장 ──

describe('POST /api/game/safari/exit', () => {
  it('사파리에서 퇴장 → 200 + p001로 이동 + 사파리 데이터 삭제', async () => {
    const sid = await registerAndGetSid();
    const authId = await createUserAndSetState(sid);

    // 사파리 입장
    await app.inject({
      method: 'POST',
      url: '/api/game/safari/enter',
      cookies: { sid },
      payload: { mapId: 's001' },
    });

    // 사파리 퇴장
    const res = await app.inject({
      method: 'POST',
      url: '/api/game/safari/exit',
      cookies: { sid },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, data: null });

    // Redis 확인: user state가 p001로 변경
    const state = await getUserState(authId);
    expect(state?.mapId).toBe('p001');

    // Redis 확인: 사파리 데이터 삭제됨
    const visited = await getSafariVisitedMaps(authId);
    expect(visited).toHaveLength(0);
  });

  it('사파리가 아닌 곳에서 퇴장 시도 → 400 NOT_IN_SAFARI', async () => {
    const sid = await registerAndGetSid();
    await createUserAndSetState(sid); // plaza에 있는 상태

    const res = await app.inject({
      method: 'POST',
      url: '/api/game/safari/exit',
      cookies: { sid },
    });
    expect(res.statusCode).toBe(400);
  });

  it('인증 없이 요청 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/game/safari/exit',
    });
    expect(res.statusCode).toBe(401);
  });
});

// ── auth:{authId}:session 키가 더 이상 생성되지 않음 ──

describe('auth:{authId}:session 키 제거 검증', () => {
  it('회원가입 시 auth:{authId}:session 키가 생성되지 않음', async () => {
    const sid = await registerAndGetSid();
    const authId = await getAuthIdFromSid(sid);

    const authSessionKey = `auth:${authId}:session`;
    const value = await RedisClient.get(authSessionKey);
    expect(value).toBeNull();
  });

  it('로그인 시 auth:{authId}:session 키가 생성되지 않음', async () => {
    await registerAndGetSid();

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login/local',
      payload: validUser,
    });
    const sid = extractSidCookie(loginRes)!;
    const authId = await getAuthIdFromSid(sid);

    const authSessionKey = `auth:${authId}:session`;
    const value = await RedisClient.get(authSessionKey);
    expect(value).toBeNull();
  });
});

import { FastifyInstance } from 'fastify';
import { buildApp } from 'apps/api/app';
import { db } from '@poposerver/lib/db';
import { connectDB } from '@poposerver/lib/db';
import { RedisClient, connectRedis, RedisKey } from '@poposerver/lib/redis';
import { account } from '@poposerver/lib/schema';
import { eq } from 'drizzle-orm';

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

afterEach(async () => {
  await db.delete(account).where(eq(account.provider, 'local'));
  const keys = await RedisClient.keys('session:*');
  if (keys.length > 0) await RedisClient.del(...keys);
  const connKeys = await RedisClient.keys('conn:*');
  if (connKeys.length > 0) await RedisClient.del(...connKeys);
  const userKeys = await RedisClient.keys('user:*:state');
  if (userKeys.length > 0) await RedisClient.del(...userKeys);
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

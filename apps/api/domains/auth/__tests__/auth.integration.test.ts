import { FastifyInstance } from 'fastify';
import { buildApp } from 'apps/api/app';
import { db } from '@poposerver/lib/db';
import { connectDB } from '@poposerver/lib/db';
import { RedisClient, connectRedis } from '@poposerver/lib/redis';
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

/** 테스트 간 격리: account 테이블 + Redis 세션 정리 */
afterEach(async () => {
  await db.delete(account).where(eq(account.provider, 'local'));
  const keys = await RedisClient.keys('session:*');
  if (keys.length > 0) await RedisClient.del(...keys);
});

// ── 헬퍼 ──

function extractSidCookie(res: Awaited<ReturnType<FastifyInstance['inject']>>): string | undefined {
  const setCookie = res.headers['set-cookie'];
  const cookieStr = Array.isArray(setCookie) ? setCookie.find((c) => c.startsWith('sid=')) : setCookie;
  if (!cookieStr) return undefined;
  const match = cookieStr.match(/sid=([^;]+)/);
  return match?.[1];
}

const validUser = { username: 'testuser1', password: 'Test1234!' };

// ── 회원가입 ──

describe('POST /api/auth/register/local', () => {
  it('회원가입 성공 → 201 + sid 쿠키', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register/local',
      payload: validUser,
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ success: true, data: null });

    const sid = extractSidCookie(res);
    expect(sid).toBeDefined();

    // Redis에 세션 생성 확인
    const sessionData = await RedisClient.get(`session:${sid}`);
    expect(sessionData).not.toBeNull();
    const session = JSON.parse(sessionData!);
    expect(session.authId).toBeDefined();
  });

  it('중복 username → 409 USER_ALREADY_EXISTS', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register/local',
      payload: validUser,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register/local',
      payload: validUser,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('USER_ALREADY_EXISTS');
  });

  it('유효하지 않은 username (너무 짧음) → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register/local',
      payload: { username: 'ab', password: 'Test1234!' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('유효하지 않은 password (숫자 없음) → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register/local',
      payload: { username: 'testuser1', password: 'Testtest!' },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ── 로그인 ──

describe('POST /api/auth/login/local', () => {
  beforeEach(async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register/local',
      payload: validUser,
    });
  });

  it('로그인 성공 → 200 + sid 쿠키 + Redis 세션', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login/local',
      payload: validUser,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, data: null });

    const sid = extractSidCookie(res);
    expect(sid).toBeDefined();

    const sessionData = await RedisClient.get(`session:${sid}`);
    expect(sessionData).not.toBeNull();
  });

  it('잘못된 비밀번호 → 401 FAILED_LOGIN', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login/local',
      payload: { username: validUser.username, password: 'WrongPass1!' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('FAILED_LOGIN');
  });

  it('존재하지 않는 username → 401 FAILED_LOGIN', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login/local',
      payload: { username: 'nouser123', password: 'Test1234!' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('FAILED_LOGIN');
  });

  it('삭제된 계정 로그인 시도 → 401 FAILED_LOGIN', async () => {
    // 먼저 로그인하여 세션 확보
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login/local',
      payload: validUser,
    });
    const sid = extractSidCookie(loginRes)!;

    // 회원 탈퇴
    await app.inject({
      method: 'DELETE',
      url: '/api/auth/delete',
      cookies: { sid },
    });

    // 삭제된 계정으로 다시 로그인 시도
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login/local',
      payload: validUser,
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('FAILED_LOGIN');
  });
});

// ── 자동 로그인 (check) ──

describe('POST /api/auth/check', () => {
  it('유효한 세션 → 200', async () => {
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register/local',
      payload: validUser,
    });
    const sid = extractSidCookie(registerRes)!;

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/check',
      cookies: { sid },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, data: null });
  });

  it('만료/삭제된 세션 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/check',
      cookies: { sid: 'invalid-session-id' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('AT_EXPIRED');
  });

  it('쿠키 없음 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/check',
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('AT_MISSING');
  });
});

// ── 로그아웃 ──

describe('POST /api/auth/logout', () => {
  it('로그아웃 → 쿠키 제거 + Redis 세션 삭제', async () => {
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register/local',
      payload: validUser,
    });
    const sid = extractSidCookie(registerRes)!;

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { sid },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, data: null });

    // Redis에서 세션 삭제 확인
    const sessionData = await RedisClient.get(`session:${sid}`);
    expect(sessionData).toBeNull();

    // 로그아웃 후 check → 401
    const checkRes = await app.inject({
      method: 'POST',
      url: '/api/auth/check',
      cookies: { sid },
    });
    expect(checkRes.statusCode).toBe(401);
  });
});

// ── 회원 탈퇴 ──

describe('DELETE /api/auth/delete', () => {
  it('회원 탈퇴 → soft delete + 쿠키 제거 + Redis 삭제', async () => {
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register/local',
      payload: validUser,
    });
    const sid = extractSidCookie(registerRes)!;

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/auth/delete',
      cookies: { sid },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, data: null });

    // Redis 세션 삭제 확인
    const sessionData = await RedisClient.get(`session:${sid}`);
    expect(sessionData).toBeNull();

    // DB에서 soft delete 확인 (deletedAt이 NOT NULL)
    const [row] = await db
      .select()
      .from(account)
      .where(eq(account.providerId, validUser.username))
      .limit(1);
    expect(row).toBeDefined();
    expect(row.deletedAt).not.toBeNull();
  });
});

// ── 중복 로그인 ──

describe('중복 로그인 → 기존 세션 교체', () => {
  it('로그인 시 새 세션 발급, 이전 세션은 Redis에서 별도 관리', async () => {
    // 회원가입
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register/local',
      payload: validUser,
    });
    const sid1 = extractSidCookie(registerRes)!;

    // 다시 로그인
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login/local',
      payload: validUser,
    });
    const sid2 = extractSidCookie(loginRes)!;

    // 새 세션이 다른 ID인지 확인
    expect(sid1).not.toBe(sid2);

    // 새 세션은 유효
    const checkRes = await app.inject({
      method: 'POST',
      url: '/api/auth/check',
      cookies: { sid: sid2 },
    });
    expect(checkRes.statusCode).toBe(200);
  });
});

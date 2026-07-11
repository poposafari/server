// 세션 — Postgres durable 스토어. 재시작 생존 → 배포마다 재로그인 없음.
// 구 Redis session:{uuid} (setex 7일) 대체. 시그니처 보존(createSession/getSession/deleteSession).

import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import { session } from '../schema';
import { logger } from '../utils/logger';

const SESSION_TTL_MS = 604_800_000; // 7일

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createSession(authId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const [row] = await db
    .insert(session)
    .values({ accountId: Number(authId), expiresAt })
    .returning({ id: session.id });
  return row.id;
}

export async function getSession(sessionId: string): Promise<{ authId: string } | null> {
  // uuid 컬럼에 비-uuid 문자열을 질의하면 Postgres가 throw → 쿠키 위조/쓰레기값 방어.
  if (!UUID_RE.test(sessionId)) return null;

  const [row] = await db
    .select({ accountId: session.accountId })
    .from(session)
    .where(and(eq(session.id, sessionId), gt(session.expiresAt, sql`now()`)));

  if (!row) return null;
  return { authId: String(row.accountId) };
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (!UUID_RE.test(sessionId)) return;
  await db.delete(session).where(eq(session.id, sessionId));
}

/** 만료 세션 정리 (janitor). Redis TTL 자동만료를 대체. */
export async function pruneExpiredSessions(): Promise<void> {
  await db.delete(session).where(lt(session.expiresAt, sql`now()`));
  logger.info('[Janitor] pruneExpiredSessions done');
}

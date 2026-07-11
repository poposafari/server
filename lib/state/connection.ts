import crypto from 'crypto';
import { OAuthProviderName } from './types';

// ── 동접 슬롯 ──

const activePlayers = new Set<string>();

/** capacity 여유가 있으면 슬롯을 점유하고 true, 가득 차 있으면 false. (check~add 사이 await 없음 = 원자적) */
export async function tryAcquireSlot(authId: string, capacity: number): Promise<boolean> {
  if (activePlayers.has(authId)) return true;
  if (activePlayers.size < capacity) {
    activePlayers.add(authId);
    return true;
  }
  return false;
}

export async function isActivePlayer(authId: string): Promise<boolean> {
  return activePlayers.has(authId);
}

export async function removeActivePlayer(authId: string): Promise<void> {
  activePlayers.delete(authId);
}

export async function getActivePlayerCount(): Promise<number> {
  return activePlayers.size;
}

export async function getAllActivePlayers(): Promise<string[]> {
  return [...activePlayers];
}

// ── conn-token 발급 후 소켓 핸드셰이크 대기 grace ──

export const CONN_RESERVED_TTL_SEC = 30;

const graceExpiry = new Map<string, number>();

export async function setConnReservedGrace(authId: string): Promise<void> {
  graceExpiry.set(authId, Date.now() + CONN_RESERVED_TTL_SEC * 1000);
}

export async function clearConnReservedGrace(authId: string): Promise<void> {
  graceExpiry.delete(authId);
}

export async function hasConnReservedGrace(authId: string): Promise<boolean> {
  const exp = graceExpiry.get(authId);
  if (exp === undefined) return false;
  if (exp <= Date.now()) {
    graceExpiry.delete(authId);
    return false;
  }
  return true;
}

// ── 1회용 연결 토큰 (30초) ──

const CONN_TOKEN_TTL_MS = 30_000;
const connTokens = new Map<string, { authId: string; expiresAt: number }>();

export async function createConnToken(authId: string): Promise<string> {
  const tokenId = crypto.randomUUID();
  connTokens.set(tokenId, { authId, expiresAt: Date.now() + CONN_TOKEN_TTL_MS });
  return tokenId;
}

export async function consumeConnToken(tokenId: string): Promise<string | null> {
  const entry = connTokens.get(tokenId);
  if (!entry) return null;
  connTokens.delete(tokenId);
  if (entry.expiresAt <= Date.now()) return null;
  return entry.authId;
}

// ── OAuth state (CSRF, 10분) ──

const OAUTH_STATE_TTL_MS = 600_000;
const oauthStates = new Map<string, { provider: OAuthProviderName; expiresAt: number }>();

export async function createOAuthState(provider: OAuthProviderName): Promise<string> {
  const state = crypto.randomUUID();
  oauthStates.set(state, { provider, expiresAt: Date.now() + OAUTH_STATE_TTL_MS });
  return state;
}

export async function consumeOAuthState(
  state: string,
): Promise<{ provider: OAuthProviderName } | null> {
  const entry = oauthStates.get(state);
  if (!entry) return null;
  oauthStates.delete(state);
  if (entry.expiresAt <= Date.now()) return null;
  return { provider: entry.provider };
}

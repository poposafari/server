// 사파리 존 야생/아이템/방문/active — 힙 스토어.
// TTL 자동만료(Redis keyspace notification) 대신 게임 루프의 1초 despawn 스캔(scanExpiredWilds)이 만료를 처리.
// 버킷 수명은 "사파리존 소속"에 묶인다 — disconnect는 유지, 명시적 퇴장(deleteAllSafariData)에서만 삭제.

import { SafariItem, SafariWild } from './types';

type WildEntry = { wild: SafariWild; expiresAt: number | null }; // shiny/S000 → null

const wilds = new Map<string, Map<string, WildEntry>>(); // key: `${authId}:${mapId}`
const items = new Map<string, SafariItem[]>(); // key: `${authId}:${mapId}`
const visited = new Map<string, Set<string>>(); // key: authId → Set<mapId>
const active = new Set<string>(); // `${authId}:${mapId}`

function bucketKey(authId: string, mapId: string): string {
  return `${authId}:${mapId}`;
}

function splitKey(key: string): { authId: string; mapId: string } {
  const sep = key.indexOf(':');
  return { authId: key.slice(0, sep), mapId: key.slice(sep + 1) };
}

// ── 야생 개체 ──

export async function addWild(
  authId: string,
  mapId: string,
  wild: SafariWild,
  ttlSec: number | null,
): Promise<number | undefined> {
  const key = bucketKey(authId, mapId);
  let bucket = wilds.get(key);
  if (!bucket) {
    bucket = new Map();
    wilds.set(key, bucket);
  }
  const expiresAt = ttlSec === null ? null : Date.now() + ttlSec * 1000;
  const { expiresAt: _ignored, ...payload } = wild;
  void _ignored;
  bucket.set(wild.uid, { wild: payload as SafariWild, expiresAt });
  return expiresAt === null ? undefined : expiresAt;
}

export async function getWild(
  authId: string,
  mapId: string,
  wildUid: string,
): Promise<SafariWild | null> {
  const entry = wilds.get(bucketKey(authId, mapId))?.get(wildUid);
  if (!entry) return null;
  if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) return null;
  return { ...entry.wild, expiresAt: entry.expiresAt ?? undefined };
}

export async function listWildIds(authId: string, mapId: string): Promise<string[]> {
  const bucket = wilds.get(bucketKey(authId, mapId));
  if (!bucket) return [];
  return [...bucket.keys()];
}

/**
 * 살아있는 wild만 반환하고, 만료된 개체는 버킷에서 제거.
 * 살아있는 wild에 expiresAt(절대 epoch ms)을 부여해 반환(클라 페이로드용).
 */
export async function getAllWildsWithCleanup(authId: string, mapId: string): Promise<SafariWild[]> {
  const bucket = wilds.get(bucketKey(authId, mapId));
  if (!bucket) return [];

  const now = Date.now();
  const out: SafariWild[] = [];
  for (const [uid, entry] of bucket) {
    if (entry.expiresAt !== null && entry.expiresAt <= now) {
      bucket.delete(uid);
      continue;
    }
    out.push({ ...entry.wild, expiresAt: entry.expiresAt ?? undefined });
  }
  return out;
}

/**
 * 동기 스냅샷: 만료 개체를 정리하고 살아있는 wild를 반환한다.
 * emit 직전에 호출하기 위한 동기 버전 — 호출~emit 사이에 await(매크로태스크)가 끼지 않아
 * world-tick despawn 스캔과의 순서가 보장된다. getAllWildsWithCleanup의 async 버전과 동일 로직.
 */
export function snapshotWilds(authId: string, mapId: string): SafariWild[] {
  const bucket = wilds.get(bucketKey(authId, mapId));
  if (!bucket) return [];
  const now = Date.now();
  const out: SafariWild[] = [];
  for (const [uid, entry] of bucket) {
    if (entry.expiresAt !== null && entry.expiresAt <= now) {
      bucket.delete(uid);
      continue;
    }
    out.push({ ...entry.wild, expiresAt: entry.expiresAt ?? undefined });
  }
  return out;
}

/** 기존 개체가 있을 때만 갱신(구 Redis XX). TTL은 유지(KEEPTTL). 존재하면 true. */
export async function updateWild(
  authId: string,
  mapId: string,
  wild: SafariWild,
): Promise<boolean> {
  const bucket = wilds.get(bucketKey(authId, mapId));
  const entry = bucket?.get(wild.uid);
  if (!entry) return false;
  const { expiresAt: _ignored, ...payload } = wild;
  void _ignored;
  entry.wild = payload as SafariWild; // expiresAt(entry) 유지
  return true;
}

export async function deleteWild(authId: string, mapId: string, wildUid: string): Promise<void> {
  wilds.get(bucketKey(authId, mapId))?.delete(wildUid);
}

/**
 * 만료된 wild를 전 버킷에서 스캔·제거하고 (authId, mapId, uid) 목록을 반환한다.
 * 게임 루프가 1초마다 호출 → 각 항목에 despawn(ttl) emit. 빈 버킷은 회수(delete).
 * shiny/S000(expiresAt=null)은 skip.
 */
export interface ExpiredWildRef {
  authId: string;
  mapId: string;
  uid: string;
}

export function scanExpiredWilds(now: number): ExpiredWildRef[] {
  const expired: ExpiredWildRef[] = [];
  for (const [key, bucket] of wilds) {
    const { authId, mapId } = splitKey(key);
    for (const [uid, entry] of bucket) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) {
        bucket.delete(uid);
        expired.push({ authId, mapId, uid });
      }
    }
    if (bucket.size === 0) wilds.delete(key);
  }
  return expired;
}

// ── 아이템 ──

export async function setSafariItems(
  authId: string,
  mapId: string,
  list: SafariItem[],
): Promise<void> {
  items.set(bucketKey(authId, mapId), list);
  let set = visited.get(authId);
  if (!set) {
    set = new Set();
    visited.set(authId, set);
  }
  set.add(mapId);
}

export async function getSafariItems(authId: string, mapId: string): Promise<SafariItem[] | null> {
  return items.get(bucketKey(authId, mapId)) ?? null;
}

/** 동기 스냅샷: 아이템 목록(없으면 빈 배열). emit 직전 호출용. */
export function snapshotItems(authId: string, mapId: string): SafariItem[] {
  return items.get(bucketKey(authId, mapId)) ?? [];
}

// ── 방문 맵 ──

export async function getSafariVisitedMaps(authId: string): Promise<string[]> {
  const set = visited.get(authId);
  return set ? [...set] : [];
}

// ── active 인덱스 (스폰 루프 탐색 대상) ──

export async function addSafariActive(authId: string, mapId: string): Promise<void> {
  active.add(bucketKey(authId, mapId));
}

export async function removeSafariActive(authId: string, mapId: string): Promise<void> {
  active.delete(bucketKey(authId, mapId));
}

export async function getSafariActive(): Promise<{ authId: string; mapId: string }[]> {
  const out: { authId: string; mapId: string }[] = [];
  for (const key of active) out.push(splitKey(key));
  return out;
}

// ── 사파리 전체 삭제 (명시적 퇴장) ──

export async function deleteAllSafariData(authId: string): Promise<void> {
  const prefix = `${authId}:`;
  for (const key of [...wilds.keys()]) {
    if (key.startsWith(prefix)) wilds.delete(key);
  }
  for (const key of [...items.keys()]) {
    if (key.startsWith(prefix)) items.delete(key);
  }
  for (const key of [...active]) {
    if (key.startsWith(prefix)) active.delete(key);
  }
  visited.delete(authId);
}

import type { ChainableCommander } from 'ioredis';
import { redis, redisSub } from '../redis';
import { logger } from '../utils/logger';
import { MasterData } from '../utils/master-data';
import { SafariItem, SafariWild } from './types';

const WILD_PREFIX = 'wild:';

const active = new Set<string>();

export interface WildSpawnEntry {
  wild: SafariWild;
  ttlSec: number | null;
}

export interface ExpiredWildRef {
  authId: string;
  mapId: string;
  uid: string;
}

function bucketKey(authId: string, mapId: string): string {
  return `${authId}:${mapId}`;
}

function splitKey(key: string): { authId: string; mapId: string } {
  const sep = key.indexOf(':');
  return { authId: key.slice(0, sep), mapId: key.slice(sep + 1) };
}

function wildKey(authId: string, mapId: string, uid: string): string {
  return `${WILD_PREFIX}${authId}:${mapId}:${uid}`;
}

function wildIndexKey(authId: string, mapId: string): string {
  return `wild-uids:${authId}:${mapId}`;
}

function itemsKey(authId: string, mapId: string): string {
  return `items:${authId}:${mapId}`;
}

function parseWildKey(key: string): ExpiredWildRef | null {
  if (!key.startsWith(WILD_PREFIX)) return null;
  const parts = key.slice(WILD_PREFIX.length).split(':');
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) return null;
  const [authId, mapId, uid] = parts;
  return { authId, mapId, uid };
}

function parseWild(key: string, raw: string | null): SafariWild | null {
  if (raw === null) return null;
  try {
    const v = JSON.parse(raw) as SafariWild;
    if (typeof v.uid === 'string' && typeof v.pokedexId === 'string') return v;
  } catch {
    logger.warn(`[WILD_STORE] ignored invalid value at ${key}`);
    return null;
  }
  logger.warn(`[WILD_STORE] ignored invalid value at ${key}`);
  return null;
}

function parseItems(key: string, raw: string | null): SafariItem[] | null {
  if (raw === null) return null;
  try {
    const v = JSON.parse(raw) as SafariItem[];
    if (Array.isArray(v)) return v;
  } catch {
    logger.warn(`[WILD_STORE] ignored invalid value at ${key}`);
    return null;
  }
  logger.warn(`[WILD_STORE] ignored invalid value at ${key}`);
  return null;
}

function isAlive(wild: SafariWild, now: number): boolean {
  return wild.expiresAt === undefined || wild.expiresAt > now;
}

async function execOrThrow(tx: ChainableCommander): Promise<void> {
  const results = await tx.exec();
  if (!results) throw new Error('Redis transaction was discarded');
  const failed = results.find(([err]) => err)?.[0];
  if (failed) throw failed;
}

function queueWilds(
  tx: ChainableCommander,
  authId: string,
  mapId: string,
  entries: WildSpawnEntry[],
): SafariWild[] {
  const now = Date.now();
  return entries.map(({ wild, ttlSec }) => {
    const stamped: SafariWild = {
      ...wild,
      expiresAt: ttlSec === null ? undefined : now + ttlSec * 1000,
    };
    const key = wildKey(authId, mapId, wild.uid);
    if (stamped.expiresAt === undefined) {
      tx.set(key, JSON.stringify(stamped));
    } else {
      tx.set(key, JSON.stringify(stamped), 'PXAT', stamped.expiresAt);
    }
    tx.sadd(wildIndexKey(authId, mapId), wild.uid);
    return stamped;
  });
}

export async function addWilds(
  authId: string,
  mapId: string,
  entries: WildSpawnEntry[],
): Promise<SafariWild[]> {
  if (entries.length === 0) return [];
  const tx = redis.multi();
  const stamped = queueWilds(tx, authId, mapId, entries);
  await execOrThrow(tx);
  return stamped;
}

export async function createSafariBucket(
  authId: string,
  mapId: string,
  entries: WildSpawnEntry[],
  items: SafariItem[],
): Promise<SafariWild[]> {
  const tx = redis.multi();
  const stamped = queueWilds(tx, authId, mapId, entries);
  tx.set(itemsKey(authId, mapId), JSON.stringify(items));
  await execOrThrow(tx);
  return stamped;
}

export async function getWild(
  authId: string,
  mapId: string,
  wildUid: string,
): Promise<SafariWild | null> {
  const key = wildKey(authId, mapId, wildUid);
  const wild = parseWild(key, await redis.get(key));
  if (!wild || !isAlive(wild, Date.now())) return null;
  return wild;
}

export async function listWildIds(authId: string, mapId: string): Promise<string[]> {
  return redis.smembers(wildIndexKey(authId, mapId));
}

export async function getAllWildsWithCleanup(authId: string, mapId: string): Promise<SafariWild[]> {
  const indexKey = wildIndexKey(authId, mapId);
  const uids = await redis.smembers(indexKey);
  if (uids.length === 0) return [];

  const keys = uids.map((uid) => wildKey(authId, mapId, uid));
  const raws = await redis.mget(keys);
  const now = Date.now();
  const live: SafariWild[] = [];
  const stale: string[] = [];
  raws.forEach((raw, i) => {
    const wild = parseWild(keys[i], raw);
    if (wild && isAlive(wild, now)) live.push(wild);
    else if (raw === null) stale.push(uids[i]);
  });
  if (stale.length > 0) await redis.srem(indexKey, ...stale);
  return live;
}

export async function updateWild(
  authId: string,
  mapId: string,
  wild: SafariWild,
): Promise<boolean> {
  const res = await redis.set(
    wildKey(authId, mapId, wild.uid),
    JSON.stringify(wild),
    'KEEPTTL',
    'XX',
  );
  return res === 'OK';
}

export async function deleteWild(authId: string, mapId: string, wildUid: string): Promise<void> {
  const tx = redis.multi();
  tx.del(wildKey(authId, mapId, wildUid));
  tx.srem(wildIndexKey(authId, mapId), wildUid);
  await execOrThrow(tx);
}

export async function subscribeWildExpiry(
  onExpired: (ref: ExpiredWildRef) => void,
): Promise<() => void> {
  const channel = `__keyevent@${redis.options.db ?? 0}__:expired`;
  const handler = (ch: string, key: string) => {
    if (ch !== channel) return;
    const ref = parseWildKey(key);
    if (!ref) return;
    redis
      .srem(wildIndexKey(ref.authId, ref.mapId), ref.uid)
      .catch((err) => logger.warn(`[WILD_STORE] index cleanup failed for ${key}:`, err));
    onExpired(ref);
  };
  redisSub.on('message', handler);
  await redisSub.subscribe(channel);
  logger.info(`[WILD_STORE] subscribed to ${channel}`);
  return () => {
    redisSub.off('message', handler);
    redisSub.unsubscribe(channel).catch(() => undefined);
  };
}

export async function setSafariItems(
  authId: string,
  mapId: string,
  list: SafariItem[],
): Promise<void> {
  await redis.set(itemsKey(authId, mapId), JSON.stringify(list));
}

export async function getSafariItems(authId: string, mapId: string): Promise<SafariItem[] | null> {
  const key = itemsKey(authId, mapId);
  return parseItems(key, await redis.get(key));
}

export async function addSafariActive(authId: string, mapId: string): Promise<void> {
  active.add(bucketKey(authId, mapId));
}

export async function removeSafariActive(authId: string, mapId: string): Promise<void> {
  active.delete(bucketKey(authId, mapId));
}

export async function getSafariActive(): Promise<{ authId: string; mapId: string }[]> {
  return [...active].map(splitKey);
}

export async function deleteAllSafariData(authId: string): Promise<void> {
  const mapIds = MasterData.getAllMaps()
    .filter((m) => m.type === 'safari')
    .map((m) => m.id);

  const read = redis.pipeline();
  mapIds.forEach((mapId) => read.smembers(wildIndexKey(authId, mapId)));
  const indexes = (await read.exec()) ?? [];

  const tx = redis.multi();
  mapIds.forEach((mapId, i) => {
    const [err, uids] = indexes[i] ?? [null, []];
    if (err) throw err;
    (uids as string[]).forEach((uid) => tx.del(wildKey(authId, mapId, uid)));
    tx.del(wildIndexKey(authId, mapId), itemsKey(authId, mapId));
  });
  await execOrThrow(tx);

  const prefix = `${authId}:`;
  [...active].filter((key) => key.startsWith(prefix)).forEach((key) => active.delete(key));
}

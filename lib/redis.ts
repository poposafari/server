import crypto from 'crypto';
import Redis, { RedisOptions } from 'ioredis';
import { envConfig } from './utils/env';
import { logger } from './utils/logger';

const redisConfig: RedisOptions = {
  host: envConfig.REDIS_HOST,
  port: envConfig.REDIS_PORT,
  password: envConfig.REDIS_PASSWORD,
  db: 0,
  lazyConnect: true,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

export const RedisClient = new Redis(redisConfig);

export const connectRedis = async (redisClient: Redis, serviceName: string) => {
  try {
    if (redisClient.status === 'ready') {
      return;
    }

    await redisClient.connect();
    logger.info(`${serviceName} Redis connection initialized successfully.`);
  } catch (error) {
    logger.error(`${serviceName} Error initializing Redis connection:`, error);
    throw error;
  }
};

export class RedisKey {
  static userState(authId: string): string {
    return `user:${authId}:state`;
  }

  static roomUsers(mapId: string): string {
    return `room:${mapId}:users`;
  }

  static connToken(tokenId: string): string {
    return `conn:${tokenId}`;
  }

  static safariMap(authId: string, mapId: string): string {
    return `safari:${authId}:${mapId}`;
  }

  static safariVisited(authId: string): string {
    return `safari:${authId}:visited`;
  }

  static safariWild(authId: string, mapId: string, wildUid: string): string {
    return `safari:${authId}:${mapId}:wild:${wildUid}`;
  }

  static safariWildIds(authId: string, mapId: string): string {
    return `safari:${authId}:${mapId}:wild_ids`;
  }

  static safariItems(authId: string, mapId: string): string {
    return `safari:${authId}:${mapId}:items`;
  }

  static safariActive(): string {
    return `safari:active`;
  }

  /** 현재 게임에 접속 중인 authId의 Set. SCARD = 동시 접속자 수, 슬롯 점유의 단일 기준. */
  static activePlayers(): string {
    return `active:players`;
  }

  /** conn-token 발급 후 소켓 핸드셰이크 대기 grace key. TTL 30s. janitor가 stale 판단 시 사용. */
  static connReserved(authId: string): string {
    return `conn:reserved:${authId}`;
  }

  /** FIFO 대기열 ZSET. score = enqueue 시각(ms), member = authId. */
  static queueWaiting(): string {
    return `queue:waiting`;
  }

  /** 큐 폴링 heartbeat ZSET. score = 최근 heartbeat ms, member = authId. janitor stale 판정용. */
  static queueWaitingLastSeen(): string {
    return `queue:waiting:lastSeen`;
  }
}

const SAFARI_WILD_KEY_RE = /^safari:([^:]+):([^:]+):wild:([^:]+)$/;

export function parseSafariWildKey(
  key: string,
): { authId: string; mapId: string; wildUid: string } | null {
  const m = SAFARI_WILD_KEY_RE.exec(key);
  if (!m) return null;
  return { authId: m[1], mapId: m[2], wildUid: m[3] };
}

export interface UserState {
  mapId: string;
  x: string;
  y: string;
  nickname: string;
  gender: string;
  costume: string;
  socketId: string;
  'pet:pokedexId': string;
  'pet:isShiny': string;
  createdAt: string;
  lastMoveTime: string;
  visitedMaps: string;
}

const USER_STATE_FIELDS: (keyof UserState)[] = [
  'mapId',
  'x',
  'y',
  'nickname',
  'gender',
  'costume',
  'socketId',
  'pet:pokedexId',
  'pet:isShiny',
  'createdAt',
  'lastMoveTime',
  'visitedMaps',
];

function toUserState(raw: Record<string, string>): UserState | null {
  if (!raw?.mapId) return null;
  const state: UserState = {} as UserState;
  for (const k of USER_STATE_FIELDS) {
    state[k] = raw[k] ?? '';
  }
  return state;
}

export async function getUserState(authId: string): Promise<UserState | null> {
  const key = RedisKey.userState(authId);
  const raw = await RedisClient.hgetall(key);
  if (!raw || Object.keys(raw).length === 0) return null;
  return toUserState(raw as Record<string, string>);
}

export async function setUserState(authId: string, state: UserState): Promise<void> {
  const key = RedisKey.userState(authId);
  await RedisClient.hset(key, state as unknown as Record<string, string>);
}

export async function deleteUserState(authId: string): Promise<void> {
  const key = RedisKey.userState(authId);
  await RedisClient.del(key);
}

export async function clearUserStateSocketId(authId: string): Promise<void> {
  const key = RedisKey.userState(authId);
  await RedisClient.hset(key, 'socketId', '');
}

const USER_STATE_KEY_PREFIX = 'user:';
const USER_STATE_KEY_SUFFIX = ':state';

export async function getAllUserStateAuthIds(): Promise<string[]> {
  const authIds: string[] = [];
  const stream = RedisClient.scanStream({
    match: `${USER_STATE_KEY_PREFIX}*${USER_STATE_KEY_SUFFIX}`,
    count: 100,
  });

  return new Promise((resolve, reject) => {
    stream.on('data', (keys: string[]) => {
      for (const key of keys) {
        if (
          key.startsWith(USER_STATE_KEY_PREFIX) &&
          key.endsWith(USER_STATE_KEY_SUFFIX) &&
          key.length > USER_STATE_KEY_PREFIX.length + USER_STATE_KEY_SUFFIX.length
        ) {
          const authId = key.slice(
            USER_STATE_KEY_PREFIX.length,
            key.length - USER_STATE_KEY_SUFFIX.length,
          );
          authIds.push(authId);
        }
      }
    });
    stream.on('end', () => resolve(authIds));
    stream.on('error', reject);
  });
}

export async function updateUserStatePosition(
  authId: string,
  updates: { x: string; y: string; lastMoveTime: string },
): Promise<void> {
  const key = RedisKey.userState(authId);
  await RedisClient.hset(key, updates);
}

export async function updateUserStateMap(
  authId: string,
  updates: { mapId: string; x: string; y: string; lastMoveTime: string },
): Promise<void> {
  const key = RedisKey.userState(authId);
  await RedisClient.hset(key, updates);
}

export async function updateUserStatePet(
  authId: string,
  pet: { pokedexId: string | null; isShiny: boolean },
): Promise<void> {
  const key = RedisKey.userState(authId);
  await RedisClient.hset(key, {
    'pet:pokedexId': pet.pokedexId ?? '',
    'pet:isShiny': pet.isShiny ? '1' : '0',
  });
}

export async function addUserToRoom(mapId: string, userId: string): Promise<void> {
  const key = RedisKey.roomUsers(mapId);
  await RedisClient.sadd(key, userId);
}

export async function removeUserFromRoom(mapId: string, userId: string): Promise<void> {
  const key = RedisKey.roomUsers(mapId);
  await RedisClient.srem(key, userId);
}

export type RoomMemberState = { userId: string } & UserState;

export function extractPetState(state: UserState): { pokedexId: string; isShiny: boolean } | null {
  const pokedexId = state['pet:pokedexId'];
  if (!pokedexId) return null;
  return { pokedexId, isShiny: state['pet:isShiny'] === '1' };
}

export async function getRoomMemberStates(mapId: string): Promise<RoomMemberState[]> {
  const roomKey = RedisKey.roomUsers(mapId);
  const userIds = await RedisClient.smembers(roomKey);
  if (userIds.length === 0) return [];

  const pipeline = RedisClient.pipeline();
  for (const userId of userIds) {
    pipeline.hgetall(RedisKey.userState(userId));
  }
  const results = await pipeline.exec();
  if (!results) return [];

  const states: RoomMemberState[] = [];
  for (let i = 0; i < results.length; i++) {
    const [err, raw] = results[i];
    if (err || !raw) continue;
    const state = toUserState(raw as Record<string, string>);
    if (state) states.push({ userId: userIds[i], ...state });
  }
  return states;
}

/** API 로그인 시 기존 소켓 킥 신호용 Redis Pub/Sub 채널 */
export const SOCKET_KICK_CHANNEL = 'socket:kick';

export interface SocketKickMessage {
  authId: string;
  targetSocketId?: string;
}

export async function publishSocketKick(authId: string, targetSocketId?: string): Promise<void> {
  const message: SocketKickMessage = { authId, targetSocketId };
  await RedisClient.publish(SOCKET_KICK_CHANNEL, JSON.stringify(message));
}

export const SOCKET_MAINTENANCE_CHANNEL = 'socket:maintenance';

export interface SocketMaintenanceMessage {
  type: 'start';
}

export async function publishSocketMaintenance(): Promise<void> {
  const message: SocketMaintenanceMessage = { type: 'start' };
  await RedisClient.publish(SOCKET_MAINTENANCE_CHANNEL, JSON.stringify(message));
}

// ── 게임 시간 관리 ──

export const GAME_TIME_KEY = 'game:time';
export const GAME_TIME_CHANNEL = 'game:time';

export interface GameTimeState {
  phase: string;
  startedAt: number; //시작 시간(ms)
  duration: number; // 전체 시간(ms)
}

export async function getGameTime(): Promise<GameTimeState | null> {
  const raw = await RedisClient.get(GAME_TIME_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GameTimeState;
  } catch {
    return null;
  }
}

export async function setGameTime(state: GameTimeState): Promise<void> {
  await RedisClient.set(GAME_TIME_KEY, JSON.stringify(state));
}

export async function publishGameTime(state: GameTimeState): Promise<void> {
  await RedisClient.publish(GAME_TIME_CHANNEL, JSON.stringify(state));
}

export const WEATHER_KEY = 'weather:state';
export const WEATHER_CHANNEL = 'weather:changed';

export interface WeatherState {
  mapId: string;
  weather: string;
  startedAt: number;
  duration: number;
}

export async function getMapWeather(mapId: string): Promise<WeatherState | null> {
  const raw = await RedisClient.hget(WEATHER_KEY, mapId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WeatherState;
  } catch {
    return null;
  }
}

export async function getAllMapWeathers(): Promise<Record<string, WeatherState>> {
  const raw = await RedisClient.hgetall(WEATHER_KEY);
  const result: Record<string, WeatherState> = {};
  for (const [mapId, json] of Object.entries(raw)) {
    try {
      result[mapId] = JSON.parse(json) as WeatherState;
    } catch {
      // skip
    }
  }
  return result;
}

export async function setMapWeather(state: WeatherState): Promise<void> {
  await RedisClient.hset(WEATHER_KEY, state.mapId, JSON.stringify(state));
}

export async function publishMapWeather(state: WeatherState): Promise<void> {
  await RedisClient.publish(WEATHER_CHANNEL, JSON.stringify(state));
}

// ── 세션 관리 ──

const SESSION_KEY_PREFIX = 'session:';
const SESSION_TTL = 604800; // 7일 (초)

export async function createSession(authId: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const sessionKey = `${SESSION_KEY_PREFIX}${sessionId}`;
  await RedisClient.setex(sessionKey, SESSION_TTL, JSON.stringify({ authId }));
  return sessionId;
}

export async function getSession(sessionId: string): Promise<{ authId: string } | null> {
  const key = `${SESSION_KEY_PREFIX}${sessionId}`;
  const data = await RedisClient.get(key);
  if (!data) return null;
  return JSON.parse(data) as { authId: string };
}

export async function deleteSession(sessionId: string): Promise<void> {
  const sessionKey = `${SESSION_KEY_PREFIX}${sessionId}`;
  await RedisClient.del(sessionKey);
}

const OAUTH_STATE_KEY_PREFIX = 'oauth:state:';
const OAUTH_STATE_TTL = 600; // 10분

export type OAuthProviderName = 'google' | 'discord';

export async function createOAuthState(provider: OAuthProviderName): Promise<string> {
  const state = crypto.randomUUID();
  const key = `${OAUTH_STATE_KEY_PREFIX}${state}`;
  await RedisClient.setex(key, OAUTH_STATE_TTL, JSON.stringify({ provider }));
  return state;
}

export async function consumeOAuthState(
  state: string,
): Promise<{ provider: OAuthProviderName } | null> {
  const key = `${OAUTH_STATE_KEY_PREFIX}${state}`;
  const data = await RedisClient.get(key);
  if (!data) return null;
  await RedisClient.del(key);
  try {
    return JSON.parse(data) as { provider: OAuthProviderName };
  } catch {
    return null;
  }
}

// ── 동접 슬롯 + FIFO 큐 ──

/** conn-token 발급 후 소켓 핸드셰이크 대기 grace (초). janitor가 이 키 존재 시 stale로 보지 않음. */
export const CONN_RESERVED_TTL_SEC = 30;

/**
 * Capacity boundary에서의 race를 막기 위해 한 Lua 트랜잭션으로
 * SCARD 체크 → SADD(슬롯 점유) 또는 ZADD(큐 + lastSeen)을 원자적으로 수행한다.
 * 반환: 'acquired' 또는 ['queued', <position 0-based>]
 *
 * KEYS[1] = active:players
 * KEYS[2] = queue:waiting
 * KEYS[3] = queue:waiting:lastSeen
 * ARGV[1] = authId
 * ARGV[2] = SLOT_CAPACITY (number)
 * ARGV[3] = NOW (ms)
 */
const ACQUIRE_OR_QUEUE_LUA = `
local active = redis.call('SCARD', KEYS[1])
if active < tonumber(ARGV[2]) then
  redis.call('SADD', KEYS[1], ARGV[1])
  return {'acquired'}
else
  redis.call('ZADD', KEYS[2], ARGV[3], ARGV[1])
  redis.call('ZADD', KEYS[3], ARGV[3], ARGV[1])
  local position = redis.call('ZRANK', KEYS[2], ARGV[1])
  return {'queued', position}
end
`;

export type AcquireOrQueueResult = { kind: 'acquired' } | { kind: 'queued'; position: number };

/** 신규 진입자에 대해 슬롯을 따거나 큐에 enqueue 한다. case (1)(2)는 호출자가 사전 분기해야 함. */
export async function acquireOrEnqueue(
  authId: string,
  capacity: number,
  now: number = Date.now(),
): Promise<AcquireOrQueueResult> {
  const raw = (await RedisClient.eval(
    ACQUIRE_OR_QUEUE_LUA,
    3,
    RedisKey.activePlayers(),
    RedisKey.queueWaiting(),
    RedisKey.queueWaitingLastSeen(),
    authId,
    String(capacity),
    String(now),
  )) as ['acquired'] | ['queued', number];

  if (raw[0] === 'acquired') return { kind: 'acquired' };
  return { kind: 'queued', position: raw[1] };
}

export async function isActivePlayer(authId: string): Promise<boolean> {
  const r = await RedisClient.sismember(RedisKey.activePlayers(), authId);
  return r === 1;
}

export async function removeActivePlayer(authId: string): Promise<void> {
  await RedisClient.srem(RedisKey.activePlayers(), authId);
}

export async function getActivePlayerCount(): Promise<number> {
  return RedisClient.scard(RedisKey.activePlayers());
}

export async function getAllActivePlayers(): Promise<string[]> {
  return RedisClient.smembers(RedisKey.activePlayers());
}

/** 큐 보유 여부 + 0-based 순번 반환. 큐에 없으면 null. */
export async function getQueuePosition(authId: string): Promise<number | null> {
  const pos = await RedisClient.zrank(RedisKey.queueWaiting(), authId);
  return pos;
}

/** 큐 polling heartbeat 갱신. score만 lastSeen ZSET에 update하므로 큐 순번에 영향 없음. */
export async function touchQueueHeartbeat(authId: string, now: number = Date.now()): Promise<void> {
  await RedisClient.zadd(RedisKey.queueWaitingLastSeen(), now, authId);
}

/** Cancel/janitor 공용. 두 ZSET에서 동시 제거. */
export async function removeFromQueue(authIds: string[]): Promise<void> {
  if (authIds.length === 0) return;
  const pipeline = RedisClient.pipeline();
  pipeline.zrem(RedisKey.queueWaiting(), ...authIds);
  pipeline.zrem(RedisKey.queueWaitingLastSeen(), ...authIds);
  await pipeline.exec();
}

/** conn-token 발급 시점에 grace 키를 SETEX. 30초 내 소켓 connection 시 DEL된다. */
export async function setConnReservedGrace(authId: string): Promise<void> {
  await RedisClient.setex(RedisKey.connReserved(authId), CONN_RESERVED_TTL_SEC, '1');
}

export async function clearConnReservedGrace(authId: string): Promise<void> {
  await RedisClient.del(RedisKey.connReserved(authId));
}

export async function hasConnReservedGrace(authId: string): Promise<boolean> {
  const r = await RedisClient.exists(RedisKey.connReserved(authId));
  return r === 1;
}

/**
 * 큐 첫 번째 사용자를 1명 promote (active로 이동) + 동시에 grace SETEX.
 * SADD와 SETEX를 한 Lua에 묶어 cleanupStaleSlots와의 race를 차단.
 * 반환: promote된 authId 또는 null (큐 비었거나 capacity 가득).
 *
 * KEYS[1] = active:players
 * KEYS[2] = queue:waiting
 * KEYS[3] = queue:waiting:lastSeen
 * ARGV[1] = SLOT_CAPACITY (number)
 * ARGV[2] = grace_key_prefix (string; "conn:reserved:")
 * ARGV[3] = grace_ttl_sec (number)
 */
const PROMOTE_FROM_QUEUE_LUA = `
local active = redis.call('SCARD', KEYS[1])
if active >= tonumber(ARGV[1]) then
  return nil
end

local next = redis.call('ZRANGE', KEYS[2], 0, 0)
if #next == 0 then
  return nil
end

local authId = next[1]
redis.call('ZREM', KEYS[2], authId)
redis.call('ZREM', KEYS[3], authId)
redis.call('SADD', KEYS[1], authId)
redis.call('SET', ARGV[2] .. authId, '1', 'EX', tonumber(ARGV[3]))
return authId
`;

export async function promoteOneFromQueue(capacity: number): Promise<string | null> {
  const result = (await RedisClient.eval(
    PROMOTE_FROM_QUEUE_LUA,
    3,
    RedisKey.activePlayers(),
    RedisKey.queueWaiting(),
    RedisKey.queueWaitingLastSeen(),
    String(capacity),
    'conn:reserved:',
    String(CONN_RESERVED_TTL_SEC),
  )) as string | null;
  return result;
}

/** janitor cleanupStaleQueue용. cutoff ms 미만 score를 가진 큐 entry 일괄 조회. */
export async function getStaleQueueMembers(cutoff: number): Promise<string[]> {
  return RedisClient.zrangebyscore(RedisKey.queueWaitingLastSeen(), 0, cutoff);
}

// ── 연결 토큰 관리 ──

const CONN_TOKEN_TTL = 30; // 30초

export async function createConnToken(authId: string): Promise<string> {
  const tokenId = crypto.randomUUID();
  const key = RedisKey.connToken(tokenId);
  await RedisClient.setex(key, CONN_TOKEN_TTL, authId);
  return tokenId;
}

export async function consumeConnToken(tokenId: string): Promise<string | null> {
  const key = RedisKey.connToken(tokenId);
  const authId = await RedisClient.get(key);
  if (authId) {
    await RedisClient.del(key);
  }
  return authId;
}

// ── 사파리 존 데이터 관리 ──

export interface SafariWild {
  uid: string;
  pokedexId: string;
  level: number;
  gender: number;
  isShiny: boolean;
  nature: string;
  ability: string;
  caught: number; // 0=WILD, 1=CAUGHT, 2=FLED
  bait: boolean;
  rock: boolean;
  caughtCount: number;
  expiresAt?: number;
}

export interface SafariItem {
  uid: string;
  itemId: string;
  picked: boolean;
}

export async function getSafariVisitedMaps(authId: string): Promise<string[]> {
  return RedisClient.smembers(RedisKey.safariVisited(authId));
}

export async function deleteAllSafariData(authId: string): Promise<void> {
  const visited = await RedisClient.smembers(RedisKey.safariVisited(authId));

  // 각 방문 맵에 대해 살아있는 wild uid 조회 (TTL로 만료되어 없을 수도 있음)
  const pipeline = RedisClient.pipeline();
  for (const mapId of visited) {
    pipeline.smembers(RedisKey.safariWildIds(authId, mapId));
  }
  const wildIdResults = visited.length ? ((await pipeline.exec()) ?? []) : [];

  const delKeys: string[] = [];
  const activeMembers: string[] = [];

  for (let i = 0; i < visited.length; i++) {
    const mapId = visited[i];
    activeMembers.push(`${authId}:${mapId}`);
    delKeys.push(RedisKey.safariWildIds(authId, mapId));
    delKeys.push(RedisKey.safariItems(authId, mapId));
    // 레거시 단일 JSON 키 방어적 삭제 (구버전 배포분 잔여)
    delKeys.push(RedisKey.safariMap(authId, mapId));
    const [err, members] = wildIdResults[i] ?? [null, []];
    if (!err && Array.isArray(members)) {
      for (const uid of members as string[]) {
        delKeys.push(RedisKey.safariWild(authId, mapId, uid));
      }
    }
  }
  delKeys.push(RedisKey.safariVisited(authId));

  const cleanupPipeline = RedisClient.pipeline();
  if (delKeys.length > 0) {
    cleanupPipeline.del(...delKeys);
  }
  if (activeMembers.length > 0) {
    cleanupPipeline.srem(RedisKey.safariActive(), ...activeMembers);
  }
  await cleanupPipeline.exec();
}

export const SAFARI_WILD_TTL_MIN_SEC = 90;
export const SAFARI_WILD_TTL_MAX_SEC = 300;

/** Worker가 publish → Socket 서버가 소비. 스폰 통지 */
export const WILD_SPAWN_CHANNEL = 'wild:spawn';
/** API/서버가 publish → Socket 서버가 소비. 명시적 디스폰(포획/도망/퇴장) */
export const WILD_DESPAWN_CHANNEL = 'wild:despawn';
/** Redis Keyspace Notifications의 expired 이벤트 채널 (db=0) */
export const KEYEVENT_EXPIRED_CHANNEL = '__keyevent@0__:expired';

export interface WildSpawnMessage {
  authId: string;
  mapId: string;
  wild: SafariWild;
}

export type WildDespawnReason = 'ttl' | 'caught' | 'fled' | 'exit';

export interface WildDespawnMessage {
  authId: string;
  mapId: string;
  wildUid: string;
  reason: WildDespawnReason;
}

export async function addWild(
  authId: string,
  mapId: string,
  wild: SafariWild,
  ttlSec: number,
): Promise<number> {
  // Redis에 저장할 때는 expiresAt을 포함하지 않는다 (TTL이 단일 진실 공급원)
  const { expiresAt: _ignored, ...payload } = wild;
  void _ignored;
  const pipeline = RedisClient.pipeline();
  pipeline.set(RedisKey.safariWild(authId, mapId, wild.uid), JSON.stringify(payload), 'EX', ttlSec);
  pipeline.sadd(RedisKey.safariWildIds(authId, mapId), wild.uid);
  await pipeline.exec();
  return Date.now() + ttlSec * 1000;
}

export async function getWild(
  authId: string,
  mapId: string,
  wildUid: string,
): Promise<SafariWild | null> {
  const raw = await RedisClient.get(RedisKey.safariWild(authId, mapId, wildUid));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SafariWild;
  } catch {
    return null;
  }
}

export async function listWildIds(authId: string, mapId: string): Promise<string[]> {
  return RedisClient.smembers(RedisKey.safariWildIds(authId, mapId));
}

/**
 * 인덱스 Set에 올라있는 uid들의 GET + PTTL을 파이프라인으로 조회.
 * 만료된 uid는 인덱스에서 SREM하고 결과에서 제외.
 * 살아있는 wild에는 남은 PTTL 기반으로 expiresAt(절대 epoch ms)을 부여해 반환.
 */
export async function getAllWildsWithCleanup(authId: string, mapId: string): Promise<SafariWild[]> {
  const uids = await RedisClient.smembers(RedisKey.safariWildIds(authId, mapId));
  if (uids.length === 0) return [];

  const pipeline = RedisClient.pipeline();
  for (const uid of uids) {
    const key = RedisKey.safariWild(authId, mapId, uid);
    pipeline.get(key);
    pipeline.pttl(key);
  }
  const results = await pipeline.exec();
  if (!results) return [];

  const wilds: SafariWild[] = [];
  const stale: string[] = [];
  const now = Date.now();
  for (let i = 0; i < uids.length; i++) {
    const [getErr, raw] = results[2 * i] ?? [null, null];
    const [pttlErr, pttl] = results[2 * i + 1] ?? [null, -2];
    if (getErr || pttlErr) continue;
    if (!raw) {
      stale.push(uids[i]);
      continue;
    }
    try {
      const parsed = JSON.parse(raw as string) as SafariWild;
      const ttlMs = typeof pttl === 'number' ? pttl : -2;
      // pttl -2: key 없음(만료), -1: TTL 없음 (안전을 위해 이 경우는 expiresAt 생략)
      if (ttlMs > 0) parsed.expiresAt = now + ttlMs;
      wilds.push(parsed);
    } catch {
      stale.push(uids[i]);
    }
  }

  if (stale.length > 0) {
    await RedisClient.srem(RedisKey.safariWildIds(authId, mapId), ...stale);
  }

  return wilds;
}

export async function updateWild(
  authId: string,
  mapId: string,
  wild: SafariWild,
): Promise<boolean> {
  const key = RedisKey.safariWild(authId, mapId, wild.uid);
  // XX: 키가 존재할 때만 set. KEEPTTL: 기존 TTL 유지.
  const ok = await RedisClient.set(key, JSON.stringify(wild), 'KEEPTTL', 'XX');
  return ok === 'OK';
}

export async function deleteWild(authId: string, mapId: string, wildUid: string): Promise<void> {
  const pipeline = RedisClient.pipeline();
  pipeline.del(RedisKey.safariWild(authId, mapId, wildUid));
  pipeline.srem(RedisKey.safariWildIds(authId, mapId), wildUid);
  await pipeline.exec();
}

export async function setSafariItems(
  authId: string,
  mapId: string,
  items: SafariItem[],
): Promise<void> {
  const pipeline = RedisClient.pipeline();
  pipeline.set(RedisKey.safariItems(authId, mapId), JSON.stringify(items));
  pipeline.sadd(RedisKey.safariVisited(authId), mapId);
  await pipeline.exec();
}

export async function getSafariItems(authId: string, mapId: string): Promise<SafariItem[] | null> {
  const raw = await RedisClient.get(RedisKey.safariItems(authId, mapId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SafariItem[];
  } catch {
    return null;
  }
}

// ── safari:active 인덱스 (Worker 스폰 루프의 탐색 대상) ──

export async function addSafariActive(authId: string, mapId: string): Promise<void> {
  await RedisClient.sadd(RedisKey.safariActive(), `${authId}:${mapId}`);
}

export async function removeSafariActive(authId: string, mapId: string): Promise<void> {
  await RedisClient.srem(RedisKey.safariActive(), `${authId}:${mapId}`);
}

export async function getSafariActive(): Promise<{ authId: string; mapId: string }[]> {
  const members = await RedisClient.smembers(RedisKey.safariActive());
  const out: { authId: string; mapId: string }[] = [];
  for (const m of members) {
    const idx = m.indexOf(':');
    if (idx <= 0) continue;
    out.push({ authId: m.slice(0, idx), mapId: m.slice(idx + 1) });
  }
  return out;
}

// ── 야생 스폰/디스폰 Pub/Sub publisher ──

export async function publishWildSpawn(msg: WildSpawnMessage): Promise<void> {
  await RedisClient.publish(WILD_SPAWN_CHANNEL, JSON.stringify(msg));
}

export async function publishWildDespawn(msg: WildDespawnMessage): Promise<void> {
  await RedisClient.publish(WILD_DESPAWN_CHANNEL, JSON.stringify(msg));
}

/**
 * Redis keyspace notifications가 Ex(expired) 이상 활성인지 확인.
 * 비활성이면 경고 로그만 찍고 throw하지 않는다 (Worker 주기 잡은 여전히 동작).
 */
export async function assertKeyspaceNotificationsEnabled(): Promise<void> {
  try {
    const res = (await RedisClient.config('GET', 'notify-keyspace-events')) as string[];
    const flags = res?.[1] ?? '';
    const hasExpired = /E/.test(flags) && (/x/.test(flags) || /A/.test(flags));
    if (!hasExpired) {
      logger.warn(
        `[Redis] notify-keyspace-events="${flags}" does not include Ex. ` +
          `Wild TTL despawn events will not fire. ` +
          `Fix: redis-server --notify-keyspace-events Ex`,
      );
    } else {
      logger.info(`[Redis] notify-keyspace-events="${flags}" (OK)`);
    }
  } catch (err) {
    logger.warn('[Redis] assertKeyspaceNotificationsEnabled failed:', err);
  }
}

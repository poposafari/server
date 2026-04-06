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
}

export interface UserState {
  mapId: string;
  x: string;
  y: string;
  nickname: string;
  level: string;
  gender: string;
  party: string;
  itemSlots: string;
  costume: string;
  socketId: string;
  pet: string;
  createdAt: string;
  lastMoveTime: string;
  visitedMaps: string;
}

const USER_STATE_FIELDS: (keyof UserState)[] = [
  'mapId',
  'x',
  'y',
  'nickname',
  'level',
  'gender',
  'party',
  'itemSlots',
  'costume',
  'socketId',
  'pet',
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

export async function setUserState(
  authId: string,
  state: UserState,
): Promise<void> {
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

export async function addUserToRoom(mapId: string, userId: string): Promise<void> {
  const key = RedisKey.roomUsers(mapId);
  await RedisClient.sadd(key, userId);
}

export async function removeUserFromRoom(mapId: string, userId: string): Promise<void> {
  const key = RedisKey.roomUsers(mapId);
  await RedisClient.srem(key, userId);
}

export type RoomMemberState = { userId: string } & UserState;

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

// ── 게임 시간 관리 ──

export const GAME_TIME_KEY = 'game:time';
export const GAME_TIME_CHANNEL = 'game:time';

export async function getGameTime(): Promise<string | null> {
  return RedisClient.get(GAME_TIME_KEY);
}

export async function setGameTime(timeOfDay: string): Promise<void> {
  await RedisClient.set(GAME_TIME_KEY, timeOfDay);
}

export async function publishGameTime(timeOfDay: string): Promise<void> {
  await RedisClient.publish(GAME_TIME_CHANNEL, timeOfDay);
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
}

export interface SafariItem {
  uid: string;
  itemId: string;
  picked: boolean;
}

export interface SafariMapData {
  wilds: SafariWild[];
  items: SafariItem[];
}

export async function setSafariMapData(
  authId: string,
  mapId: string,
  data: SafariMapData,
): Promise<void> {
  const pipeline = RedisClient.pipeline();
  pipeline.set(RedisKey.safariMap(authId, mapId), JSON.stringify(data));
  pipeline.sadd(RedisKey.safariVisited(authId), mapId);
  await pipeline.exec();
}

export async function getSafariMapData(
  authId: string,
  mapId: string,
): Promise<SafariMapData | null> {
  const raw = await RedisClient.get(RedisKey.safariMap(authId, mapId));
  if (!raw) return null;
  return JSON.parse(raw) as SafariMapData;
}

export async function getSafariVisitedMaps(authId: string): Promise<string[]> {
  return RedisClient.smembers(RedisKey.safariVisited(authId));
}

export async function deleteAllSafariData(authId: string): Promise<void> {
  const visited = await RedisClient.smembers(RedisKey.safariVisited(authId));
  const keys = visited.map((mapId) => RedisKey.safariMap(authId, mapId));
  keys.push(RedisKey.safariVisited(authId));
  await RedisClient.del(...keys);
}

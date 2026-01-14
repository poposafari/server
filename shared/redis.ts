import Redis, { RedisOptions } from 'ioredis';
import { envConfig } from './utils';

const redisConfig: RedisOptions = {
  host: envConfig.REDIS_HOST,
  port: envConfig.REDIS_PORT,
  password: envConfig.REDIS_PASSWORD,
  db: 0, // 기본 DB (0번) 사용

  // true로 설정하면 인스턴스 생성 시 자동 연결을 시도하지 않음.
  // connectRedis 함수에서 명시적으로 연결하기 위함.
  lazyConnect: true,

  // 연결이 끊겼을 때 2초(2000ms) 간격으로 재시도.
  retryStrategy: (times) => {
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
    console.info(`[INFO] ${serviceName} Redis connection initialized successfully.`);
  } catch (error) {
    console.error(`[ERROR] ${serviceName} Error initializing Redis connection:`, error);
    throw error;
  }
};

export class RedisKey {
  static userRefresh(authId: string): string {
    return `auth:${authId}:refresh`;
  }
}

export async function saveRefreshTokenInRedis(
  authId: string,
  refreshToken: string,
  ttl: number = 604800, //<-- 7 days
): Promise<void> {
  const key = RedisKey.userRefresh(authId);
  await RedisClient.setex(key, ttl, refreshToken);
}

export async function verifyRefreshTokenInRedis(
  authId: string,
  tokenFromCookie: string,
): Promise<boolean> {
  const key = RedisKey.userRefresh(authId);
  const storedToken = await RedisClient.get(key);

  return storedToken === tokenFromCookie;
}

export async function deleteRefreshTokenInRedis(authId: string): Promise<void> {
  const key = RedisKey.userRefresh(authId);
  await RedisClient.del(key);
}

export async function getRefreshTokenInRedis(authId: string): Promise<string | null> {
  const key = RedisKey.userRefresh(authId);
  return await RedisClient.get(key);
}

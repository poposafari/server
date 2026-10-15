import Redis from 'ioredis';
import { envConfig } from './utils';
import { logger } from './utils/logger';

const CONNECT_WAIT_MS = 10_000;

export const redis = new Redis(envConfig.REDIS_URL, {
  lazyConnect: true,
  connectionName: 'poposerver:cmd',
});

export const redisSub = redis.duplicate({ connectionName: 'poposerver:sub' });

let closing = false;

function watchConnection(client: Redis, label: string) {
  let down = false;
  client.on('error', (error) => {
    if (down || closing) return;
    down = true;
    logger.error(`Redis ${label} connection lost:`, error);
  });
  client.on('close', () => {
    if (down || closing) return;
    down = true;
    logger.warn(`Redis ${label} connection closed.`);
  });
  client.on('ready', () => {
    if (!down) return;
    down = false;
    logger.info(`Redis ${label} connection recovered.`);
  });
}

watchConnection(redis, 'command');
watchConnection(redisSub, 'subscriber');

function waitUntilReady(client: Redis, label: string): Promise<void> {
  if (client.status === 'ready') return Promise.resolve();
  let timer: NodeJS.Timeout | undefined;
  const ready = new Promise<void>((resolve) => {
    client.once('ready', () => resolve());
  });
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Redis ${label} connection not ready within ${CONNECT_WAIT_MS}ms`)),
      CONNECT_WAIT_MS,
    );
  });
  return Promise.race([ready, timeout]).finally(() => clearTimeout(timer));
}

export const connectRedis = async (serviceName: string) => {
  try {
    redis.connect().catch(() => undefined);
    redisSub.connect().catch(() => undefined);
    await Promise.all([waitUntilReady(redis, 'command'), waitUntilReady(redisSub, 'subscriber')]);
    logger.info(`${serviceName} Redis connections initialized successfully.`);
  } catch (error) {
    redis.disconnect();
    redisSub.disconnect();
    logger.error(`${serviceName} Error initializing Redis connection:`, error);
    throw error;
  }
};

export const closeRedis = async () => {
  closing = true;
  await Promise.all(
    [redis, redisSub].map(async (client) => {
      if (client.status === 'ready') {
        await client.quit().catch(() => client.disconnect());
      } else {
        client.disconnect();
      }
    }),
  );
  logger.info('Redis connections closed.');
};

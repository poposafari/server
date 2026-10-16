import { redis } from './redis';
import { AppErrorCode } from './types';
import { AppError } from './utils/error';
import { logger } from './utils/logger';

export const REDIS_RETRY_WINDOW_MS = 30_000;
const RETRY_INTERVAL_MS = 1_000;

export interface RedisRetry {
  label: string;
  deadline: number;
  isCancelled?: () => boolean;
}

export class RedisRetryCancelled extends Error {
  constructor(label: string) {
    super(`Redis retry cancelled: ${label}`);
    Object.setPrototypeOf(this, RedisRetryCancelled.prototype);
  }
}

export function redisRetry(
  label: string,
  receivedAt: number,
  isCancelled?: () => boolean,
): RedisRetry {
  return { label, deadline: receivedAt + REDIS_RETRY_WINDOW_MS, isCancelled };
}

export function isRedisGiveUp(error: unknown): boolean {
  return error instanceof AppError && error.code === AppErrorCode.SAFARI_STATE_UNAVAILABLE;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function withinDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  work.catch(() => undefined);
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Redis call still pending after ${ms}ms`)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

async function attempt<T>(
  retry: RedisRetry,
  fn: () => Promise<T>,
  tries: number,
  lastError: unknown,
): Promise<T> {
  if (retry.isCancelled?.()) throw new RedisRetryCancelled(retry.label);

  const remaining = retry.deadline - Date.now();
  if (remaining <= 0) {
    const waited = Date.now() - (retry.deadline - REDIS_RETRY_WINDOW_MS);
    const detail = lastError ? '' : ' without sending a command';
    logger.error(
      `[REDIS_RETRY] gave up ${retry.label} after ${waited}ms${detail} (tries=${tries}, status=${redis.status})`,
      lastError ?? undefined,
    );
    throw new AppError('Safari state unavailable', 500, AppErrorCode.SAFARI_STATE_UNAVAILABLE);
  }

  let error = lastError;
  let nextTries = tries;
  if (redis.status === 'ready') {
    nextTries += 1;
    try {
      return await withinDeadline(fn(), remaining);
    } catch (err) {
      error = err;
    }
  }

  await sleep(Math.max(0, Math.min(RETRY_INTERVAL_MS, retry.deadline - Date.now())));
  return attempt(retry, fn, nextTries, error);
}

export function withRedisRetry<T>(retry: RedisRetry, fn: () => Promise<T>): Promise<T> {
  return attempt(retry, fn, 0, null);
}

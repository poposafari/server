import { drainDirty, persistUserStateFromRedisToDb, logger } from '@poposerver/lib';

const FLUSH_INTERVAL_MS = 180_000;
const FLUSH_CONCURRENCY = 10;

export async function flushDirtyPositions(): Promise<void> {
  const authIds = drainDirty();
  if (authIds.length === 0) return;

  const start = Date.now();
  let success = 0;
  let failures = 0;

  for (let i = 0; i < authIds.length; i += FLUSH_CONCURRENCY) {
    const batch = authIds.slice(i, i + FLUSH_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((authId) => persistUserStateFromRedisToDb(authId, { deleteFromRedis: false })),
    );
    for (const r of results) {
      if (r.status === 'fulfilled') success++;
      else {
        failures++;
        logger.warn('[FLUSH] persist failed:', r.reason);
      }
    }
  }

  logger.info(
    `[FLUSH] cycle finished in ${Date.now() - start}ms — total=${authIds.length}, success=${success}, failures=${failures}`,
  );
}

export async function flushAllPositions(): Promise<void> {
  await flushDirtyPositions();
}

export function startPositionFlushLoop(): () => void {
  let running = false;
  let stopped = false;

  const timer = setInterval(async () => {
    if (running || stopped) return;
    running = true;
    try {
      await flushDirtyPositions();
    } catch (err) {
      logger.error('[FLUSH] cycle crashed:', err);
    } finally {
      running = false;
    }
  }, FLUSH_INTERVAL_MS);

  logger.info(`[FLUSH] Loop started: every ${FLUSH_INTERVAL_MS}ms (dirty only)`);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

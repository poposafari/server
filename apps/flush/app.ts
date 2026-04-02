import cron from 'node-cron';
import { getAllUserStateAuthIds, persistUserStateFromRedisToDb, logger } from '@poposerver/lib';
import { everyMinutes } from '@poposerver/lib/utils/cron';

/** flush 설정 상수 (하드코딩) */
const FLUSH_INTERVAL_MIN = 3;
const FLUSH_INTERVAL_MS: number | undefined = undefined;
const FLUSH_CONCURRENCY = 10;

/** flush 사이클 1회 실행 */
export async function runFlushCycle(concurrency: number): Promise<void> {
  const start = Date.now();
  logger.info('[FLUSH] Flush cycle started');

  const authIds = await getAllUserStateAuthIds();
  let success = 0;
  let failures = 0;

  for (let i = 0; i < authIds.length; i += concurrency) {
    const batch = authIds.slice(i, i + concurrency);
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

  const elapsed = Date.now() - start;
  logger.info(
    `[FLUSH] Flush cycle finished in ${elapsed}ms — total=${authIds.length}, success=${success}, failures=${failures}`,
  );
}

/**
 * flush 주기 시작. 정지 함수를 반환한다.
 * - FLUSH_INTERVAL_MS가 있으면 setInterval 사용
 * - 없으면 FLUSH_INTERVAL_MIN으로 node-cron 사용
 */
export function startFlush(): () => Promise<void> {
  let running = false;
  let stopped = false;

  const execute = async () => {
    if (running || stopped) return;
    running = true;
    try {
      await runFlushCycle(FLUSH_CONCURRENCY);
    } finally {
      running = false;
    }
  };

  if (FLUSH_INTERVAL_MS) {
    const timer = setInterval(execute, FLUSH_INTERVAL_MS);
    logger.info(`[FLUSH] Scheduled with setInterval: every ${FLUSH_INTERVAL_MS}ms`);

    return async () => {
      stopped = true;
      clearInterval(timer);
      while (running) await new Promise((r) => setTimeout(r, 50));
    };
  }

  const cronExpr = everyMinutes(FLUSH_INTERVAL_MIN);
  const task = cron.schedule(cronExpr, execute);
  logger.info(`[FLUSH] Scheduled with cron: "${cronExpr}" (every ${FLUSH_INTERVAL_MIN}min)`);

  return async () => {
    stopped = true;
    task.stop();
    while (running) await new Promise((r) => setTimeout(r, 50));
  };
}

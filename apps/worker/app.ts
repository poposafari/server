import { DataSource } from 'typeorm';
import cron from 'node-cron';
import { getAllUserStateAuthIds, persistUserStateFromRedisToDb, logger } from '@poposerver/shared';

export function startPeriodicUserStateBackup(dataSource: DataSource, cronSchedule: string): void {
  cron.schedule(cronSchedule, async () => {
    const start = Date.now();
    logger.info('[Worker] User state backup job started');

    try {
      const authIds = await getAllUserStateAuthIds();
      let success = 0;
      let failures = 0;

      await Promise.all(
        authIds.map(async (authId) => {
          try {
            await persistUserStateFromRedisToDb(authId, dataSource, { deleteFromRedis: false });
            success += 1;
          } catch (err) {
            failures += 1;
            logger.warn(`[Worker] persist failed for authId=${authId}`, err);
          }
        }),
      );

      const elapsed = Date.now() - start;
      logger.info(
        `[Worker] User state backup job finished in ${elapsed}ms, total=${authIds.length}, success=${success}, failures=${failures}`,
      );
    } catch (err) {
      logger.error('[Worker] User state backup job error', err);
    }
  });

  logger.info(`[Worker] User state backup scheduled: ${cronSchedule}`);
}

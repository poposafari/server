import {
  connectDB,
  connectRedis,
  everyMinutes,
  logger,
  MasterData,
  RedisClient,
} from '@poposerver/lib';
import { startPeriodicUserStateBackup } from './app';

async function boot() {
  try {
    await connectDB('WORKER');
    await connectRedis(RedisClient, 'WORKER');
    await MasterData.load('WORKER');

    startPeriodicUserStateBackup(everyMinutes(3));

    const shutdown = async (signal: string) => {
      logger.info(`[${signal}] Shutting down...`);
      try {
        logger.info('[Bye] Cleanup finished.');
        process.exit(0);
      } catch (error) {
        logger.error('[Fatal] Error during shutdown:', error);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('[FATAL] Failed to start server:', error);
    process.exit(1);
  }
}

boot();

import { connectDB, connectRedis, logger, RedisClient } from '@poposerver/lib';
import { startFlush } from './app';

async function boot() {
  try {
    await connectDB('FLUSH');
    await connectRedis(RedisClient, 'FLUSH');

    const stop = startFlush();

    const shutdown = async (signal: string) => {
      logger.info(`[FLUSH] Received ${signal}. Shutting down gracefully...`);
      await stop();
      await RedisClient.quit();
      logger.info('[FLUSH] Shutdown complete.');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('[FATAL] Failed to start Flush server:', error);
    process.exit(1);
  }
}

boot();

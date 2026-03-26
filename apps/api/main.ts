import { envConfig } from '@poposerver/lib/utils/env';
import { connectDB } from '@poposerver/lib/db';
import { connectRedis, RedisClient } from '@poposerver/lib/redis';
import { MasterData } from '@poposerver/lib/utils/master-data';
import { logger } from '@poposerver/lib/utils/logger';
import { buildApp } from './app';

async function boot() {
  try {
    await connectDB('API');
    await connectRedis(RedisClient, 'API');
    await MasterData.load('API');

    const app = await buildApp();
    await app.listen({ port: envConfig.API_PORT, host: '0.0.0.0' });
    logger.info(`API Server is running on port ${envConfig.API_PORT}`);

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      await app.close();
      await RedisClient.quit();
      logger.info('API Server shut down complete');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error('[FATAL] Failed to start API server:', error);
    process.exit(1);
  }
}

boot();

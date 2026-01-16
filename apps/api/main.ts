import {
  AppDataSource,
  connectDB,
  connectRedis,
  envConfig,
  MasterData,
  RedisClient,
} from '@poposerver/shared';
import app from './app';
import { logger } from '@poposerver/shared/utils/logger';

async function boot() {
  try {
    await connectDB(AppDataSource, 'API');
    await connectRedis(RedisClient, 'API');
    await MasterData.load('API');

    app.listen(envConfig.API_PORT, () => {
      logger.info(`API Server is running on port ${envConfig.API_PORT}`);
    });
  } catch (error) {
    logger.error('[FATAL] Failed to start server:', error);
    process.exit(1);
  }
}

boot();

import {
  AppDataSource,
  connectDB,
  connectRedis,
  envConfig,
  logger,
  MasterData,
  RedisClient,
} from '@poposerver/shared';
import { SocketApp } from './app';

async function boot() {
  try {
    await connectDB(AppDataSource, 'SOCKET');
    await connectRedis(RedisClient, 'SOCKET');
    await MasterData.load('SOCKET');

    const socketApp = new SocketApp();
    socketApp.listen();

    const shutdown = async (signal: string) => {
      logger.info(`[${signal}] Shutting down...`);
      try {
        await socketApp.close();
        await RedisClient.quit();
        if (AppDataSource.isInitialized) await AppDataSource.destroy();
        logger.info('[Bye] Cleanup finished.');
        process.exit(0);
      } catch (error) {
        logger.error('[Fatal] Error during shutdown:', error);
        process.exit(1);
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

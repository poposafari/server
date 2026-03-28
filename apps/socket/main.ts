import {
  connectDB,
  connectRedis,
  logger,
  MasterData,
  RedisClient,
  SOCKET_KICK_CHANNEL,
} from '@poposerver/lib';
import { SocketApp } from './app';

async function boot() {
  try {
    await connectDB('SOCKET');
    await connectRedis(RedisClient, 'SOCKET');
    await MasterData.load('SOCKET');

    const socketApp = new SocketApp(RedisClient);
    socketApp.listen();

    const kickSub = RedisClient.duplicate();
    await connectRedis(kickSub, 'SOCKET_KICK_SUB');
    await kickSub.subscribe(SOCKET_KICK_CHANNEL);
    kickSub.on('message', (channel: string, authId: string) => {
      if (channel === SOCKET_KICK_CHANNEL) {
        void socketApp
          .kickByAuthId(authId)
          .catch((err) => logger.error('[Socket] kickByAuthId failed:', err));
      }
    });

    const shutdown = async (signal: string) => {
      logger.info(`[${signal}] Shutting down...`);
      try {
        await kickSub.quit();
        await socketApp.close();
        await RedisClient.quit();

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

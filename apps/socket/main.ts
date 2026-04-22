import {
  connectDB,
  connectRedis,
  logger,
  MasterData,
  RedisClient,
  SOCKET_KICK_CHANNEL,
  SocketKickMessage,
  GAME_TIME_CHANNEL,
  GameTimeState,
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
    kickSub.on('message', (channel: string, raw: string) => {
      if (channel === SOCKET_KICK_CHANNEL) {
        try {
          const msg = JSON.parse(raw) as SocketKickMessage;
          socketApp.kick(msg.authId, msg.targetSocketId);
        } catch (err) {
          logger.error('[Socket] kick failed:', err);
        }
      }
    });

    const gameTimeSub = RedisClient.duplicate();
    await connectRedis(gameTimeSub, 'SOCKET_GAME_TIME_SUB');
    await gameTimeSub.subscribe(GAME_TIME_CHANNEL);
    gameTimeSub.on('message', (channel: string, raw: string) => {
      if (channel === GAME_TIME_CHANNEL) {
        try {
          const state = JSON.parse(raw) as GameTimeState;
          socketApp.broadcastGameTime(state);
        } catch (err) {
          logger.error('[Socket] game time parse failed:', err);
        }
      }
    });

    const shutdown = async (signal: string) => {
      logger.info(`[${signal}] Shutting down...`);
      try {
        await gameTimeSub.quit();
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

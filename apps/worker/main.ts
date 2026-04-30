import { connectDB, connectRedis, logger, MasterData, RedisClient } from '@poposerver/lib';
import { startGameTimeClock } from './game-time';
import { startWeatherClock } from './weather';
import { startWildSpawnLoop } from './wild-spawn';

async function boot() {
  try {
    await connectDB('WORKER');
    await connectRedis(RedisClient, 'WORKER');
    await MasterData.load('WORKER');

    const stopGameTime = startGameTimeClock();
    const stopWeather = startWeatherClock();
    const stopWildSpawn = startWildSpawnLoop();

    const shutdown = async (signal: string) => {
      logger.info(`[${signal}] Shutting down...`);
      try {
        stopGameTime();
        stopWeather();
        await stopWildSpawn();
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

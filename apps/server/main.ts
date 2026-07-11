import { connectDB } from '@poposerver/lib/db';
import { MasterData } from '@poposerver/lib/utils/master-data';
import { envConfig } from '@poposerver/lib/utils/env';
import { logger } from '@poposerver/lib/utils/logger';
import { registerBroadcaster } from '@poposerver/lib';
import { buildApp } from '../api/app';
import { SocketApp } from '../socket/app';
import { startWeatherClock } from './game-loop/weather';
import { startWildSpawnLoop } from './game-loop/wild-spawn';
import { startWorldTickLoop } from './game-loop/world-tick';
import { startJanitorLoops } from './game-loop/janitor';
import { startPositionFlushLoop, flushAllPositions } from './flush/position-flush';

async function boot() {
  try {
    await connectDB('SERVER');
    await MasterData.load('SERVER');

    const app = await buildApp();
    const socketApp = new SocketApp(app.server);
    registerBroadcaster(socketApp);

    const stopWeather = startWeatherClock();
    const stopSpawn = startWildSpawnLoop();
    const stopWorldTick = startWorldTickLoop();
    const stopJanitor = startJanitorLoops();
    const stopFlush = startPositionFlushLoop();

    await app.listen({ port: envConfig.API_PORT, host: '0.0.0.0' });
    logger.info(`SERVER (REST + WebSocket) running on port ${envConfig.API_PORT}`);

    let shuttingDown = false;
    const shutdown = async (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      try {
        stopWeather();
        await stopSpawn();
        stopWorldTick();
        await stopJanitor();
        stopFlush();

        await flushAllPositions();
        await socketApp.close();
        await app.close();
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

import { AppDataSource, envConfig, MapManager, MasterData, RedisStore } from '@poposerver/shared';
import { SchedulerManager } from './scheduler';
import path from 'path';

async function bootstrap() {
  console.log(`[Worker] Starting... (Env: ${envConfig.NODE_ENV})`);

  try {
    await AppDataSource.initialize();
    console.log('[Worker] DB Connected.');

    await RedisStore.connect();
    console.log('[Worker] Redis Connected.');

    await MasterData.load();
    console.log('[Worker] MasterData Loaded.');

    const mapDir = path.resolve(process.cwd(), 'shared/master');
    await MapManager.load(mapDir);
    console.log('[Worker] MapData Loaded.');

    SchedulerManager.start();
    console.log('[Worker] Running successfully! 🚀');
  } catch (error) {
    console.error('[Worker] Fatal Error:', error);
    process.exit(1);
  }
}

bootstrap();

import { AppDataSource, connectDB, connectRedis, envConfig, MasterData, RedisClient } from 'shared';
import app from './app';

async function boot() {
  try {
    await connectDB(AppDataSource, 'API');
    await connectRedis(RedisClient, 'API');
    await MasterData.load('API');

    app.listen(envConfig.API_PORT, () => {
      console.info(`[INFO] API Server is running on port ${envConfig.API_PORT}`);
    });
  } catch (error) {
    console.error('[FATAL] Failed to start server:', error);
    process.exit(1);
  }
}

boot();

import {
  connectDB,
  connectRedis,
  logger,
  MasterData,
  RedisClient,
  RedisKey,
  SOCKET_KICK_CHANNEL,
  SocketKickMessage,
  SOCKET_MAINTENANCE_CHANNEL,
  SocketMaintenanceMessage,
  GAME_TIME_CHANNEL,
  GameTimeState,
  WEATHER_CHANNEL,
  WeatherState,
  WILD_SPAWN_CHANNEL,
  WILD_DESPAWN_CHANNEL,
  KEYEVENT_EXPIRED_CHANNEL,
  WildSpawnMessage,
  WildDespawnMessage,
  assertKeyspaceNotificationsEnabled,
  parseSafariWildKey,
} from '@poposerver/lib';
import { SocketApp } from './app';

async function boot() {
  try {
    await connectDB('SOCKET');
    await connectRedis(RedisClient, 'SOCKET');
    await MasterData.load('SOCKET');

    await assertKeyspaceNotificationsEnabled();

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

    const maintenanceSub = RedisClient.duplicate();
    await connectRedis(maintenanceSub, 'SOCKET_MAINTENANCE_SUB');
    await maintenanceSub.subscribe(SOCKET_MAINTENANCE_CHANNEL);
    maintenanceSub.on('message', (channel: string, raw: string) => {
      if (channel !== SOCKET_MAINTENANCE_CHANNEL) return;
      try {
        const msg = JSON.parse(raw) as SocketMaintenanceMessage;
        if (msg.type === 'start') {
          socketApp.broadcastMaintenance();
        }
      } catch (err) {
        logger.error('[Socket] maintenance broadcast failed:', err);
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

    const weatherSub = RedisClient.duplicate();
    await connectRedis(weatherSub, 'SOCKET_WEATHER_SUB');
    await weatherSub.subscribe(WEATHER_CHANNEL);
    weatherSub.on('message', (channel: string, raw: string) => {
      if (channel !== WEATHER_CHANNEL) return;
      try {
        const state = JSON.parse(raw) as WeatherState;
        socketApp.broadcastWeather(state);
      } catch (err) {
        logger.error('[Socket] weather parse failed:', err);
      }
    });

    const wildSpawnSub = RedisClient.duplicate();
    await connectRedis(wildSpawnSub, 'SOCKET_WILD_SPAWN_SUB');
    await wildSpawnSub.subscribe(WILD_SPAWN_CHANNEL);
    wildSpawnSub.on('message', (channel: string, raw: string) => {
      if (channel !== WILD_SPAWN_CHANNEL) return;
      try {
        const msg = JSON.parse(raw) as WildSpawnMessage;
        socketApp.emitWildSpawn(msg.authId, msg.mapId, msg.wild);
      } catch (err) {
        logger.error('[Socket] wild spawn parse failed:', err);
      }
    });

    const wildDespawnSub = RedisClient.duplicate();
    await connectRedis(wildDespawnSub, 'SOCKET_WILD_DESPAWN_SUB');
    await wildDespawnSub.subscribe(WILD_DESPAWN_CHANNEL);
    wildDespawnSub.on('message', (channel: string, raw: string) => {
      if (channel !== WILD_DESPAWN_CHANNEL) return;
      try {
        const msg = JSON.parse(raw) as WildDespawnMessage;
        socketApp.emitWildDespawn(msg.authId, msg.mapId, msg.wildUid, msg.reason);
      } catch (err) {
        logger.error('[Socket] wild despawn parse failed:', err);
      }
    });

    // TTL 만료 감지: __keyevent@0__:expired 채널로 만료된 키 이름이 전달됨.
    // safari:{authId}:{mapId}:wild:{uid} 패턴에 매칭되면 해당 유저에게 despawn(ttl) emit.
    const expirySub = RedisClient.duplicate();
    await connectRedis(expirySub, 'SOCKET_EXPIRY_SUB');
    await expirySub.subscribe(KEYEVENT_EXPIRED_CHANNEL);
    expirySub.on('message', async (channel: string, key: string) => {
      if (channel !== KEYEVENT_EXPIRED_CHANNEL) return;
      const parsed = parseSafariWildKey(key);
      if (!parsed) return;
      try {
        socketApp.emitWildDespawn(parsed.authId, parsed.mapId, parsed.wildUid, 'ttl');
        await RedisClient.srem(RedisKey.safariWildIds(parsed.authId, parsed.mapId), parsed.wildUid);
      } catch (err) {
        logger.error('[Socket] wild expiry handling failed:', err);
      }
    });

    const shutdown = async (signal: string) => {
      logger.info(`[${signal}] Shutting down...`);
      try {
        await expirySub.quit();
        await wildDespawnSub.quit();
        await wildSpawnSub.quit();
        await weatherSub.quit();
        await gameTimeSub.quit();
        await maintenanceSub.quit();
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

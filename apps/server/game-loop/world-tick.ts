import {
  getCurrentPhaseState,
  publishGameTime,
  publishWildDespawn,
  scanExpiredWilds,
  logger,
} from '@poposerver/lib';

const TICK_MS = 1_000;

export function startWorldTickLoop(): () => void {
  let lastPhase: string | null = null;
  let running = false;
  let stopped = false;

  const timer = setInterval(async () => {
    if (running || stopped) return;
    running = true;
    try {
      const now = Date.now();
      const expired = scanExpiredWilds(now);
      for (const { authId, mapId, uid } of expired) {
        await publishWildDespawn({ authId, mapId, wildUid: uid, reason: 'ttl' });
      }

      const state = getCurrentPhaseState();
      if (state.phase !== lastPhase) {
        lastPhase = state.phase;
        await publishGameTime(state);
        logger.info(`[GAME_TIME] Phase changed to: ${state.phase}`);
      }
    } catch (err) {
      logger.error('[WORLD_TICK] tick failed:', err);
    } finally {
      running = false;
    }
  }, TICK_MS);

  logger.info(`[WORLD_TICK] Loop started: every ${TICK_MS}ms (despawn scan + game-time broadcast)`);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

import {
  getCachedGameTime,
  getCurrentPhaseState,
  loadStoredGameTime,
  publishGameTime,
  publishWildDespawn,
  restoreGameTime,
  setGameTime,
  subscribeWildExpiry,
  logger,
} from '@poposerver/lib';

const TICK_MS = 1_000;

async function advanceGameTime(): Promise<void> {
  const now = Date.now();
  const cached = getCachedGameTime();
  if (cached && cached.startedAt + cached.duration > now) return;
  const next = getCurrentPhaseState(now);
  await setGameTime(next);
  await publishGameTime(next);
  logger.info(`[GAME_TIME] Phase changed to: ${next.phase}`);
}

export async function initGameTime(): Promise<void> {
  const stored = await loadStoredGameTime();
  if (stored && stored.startedAt + stored.duration > Date.now()) {
    restoreGameTime(stored);
    logger.info(`[GAME_TIME] revived: ${stored.phase} (moon ${stored.moonPhase})`);
    return;
  }
  await advanceGameTime();
}

export async function startWorldTickLoop(): Promise<() => void> {
  let running = false;
  let stopped = false;

  const unsubscribe = await subscribeWildExpiry(({ authId, mapId, uid }) => {
    publishWildDespawn({ authId, mapId, wildUid: uid, reason: 'ttl' }).catch((err) =>
      logger.error('[WORLD_TICK] despawn publish failed:', err),
    );
  });

  const timer = setInterval(async () => {
    if (running || stopped) return;
    running = true;
    try {
      await advanceGameTime();
    } catch (err) {
      logger.error('[WORLD_TICK] tick failed:', err);
    } finally {
      running = false;
    }
  }, TICK_MS);

  logger.info(`[WORLD_TICK] Loop started: every ${TICK_MS}ms (game-time broadcast)`);

  return () => {
    stopped = true;
    clearInterval(timer);
    unsubscribe();
  };
}

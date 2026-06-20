import {
  addWild,
  getAllMapWeathers,
  getAllWildsWithCleanup,
  getSafariActive,
  getUserState,
  logger,
  MasterData,
  publishWildSpawn,
  removeSafariActive,
  S000_MAP_ID,
  TimeOfDay,
  Weather,
} from '@poposerver/lib';
import { getGameTime } from '@poposerver/lib';
import { generateWildBatch, randomWildTtlSec } from '@poposerver/lib/utils/wild-roll';

const SPAWN_TICK_MS = 10_000;
const CONCURRENCY = 10;

/** safari:active에 올라있는 각 (authId, mapId) 쌍에 대해 wild 개체수가 max 미만이면 max까지 보충한다. */
export async function runWildSpawnCycle(concurrency: number = CONCURRENCY): Promise<void> {
  const start = Date.now();
  const pairs = await getSafariActive();
  if (pairs.length === 0) {
    return;
  }

  const gameTime = await getGameTime();
  const timeOfDay = (gameTime?.phase ?? TimeOfDay.DAY) as TimeOfDay;

  const weatherByMap = await getAllMapWeathers();

  let spawned = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < pairs.length; i += concurrency) {
    const batch = pairs.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map((p) => {
        const w = (weatherByMap[p.mapId]?.weather as Weather) ?? Weather.SUNNY;
        return processPair(p.authId, p.mapId, timeOfDay, w);
      }),
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value === 'skipped') skipped++;
        else spawned += r.value;
      } else {
        failed++;
        logger.warn('[WILD_SPAWN] pair failed:', r.reason);
      }
    }
  }

  const elapsed = Date.now() - start;
  logger.info(
    `[WILD_SPAWN] cycle finished in ${elapsed}ms — pairs=${pairs.length} spawned=${spawned} skipped=${skipped} failed=${failed}`,
  );
}

async function processPair(
  authId: string,
  mapId: string,
  timeOfDay: TimeOfDay,
  weather: Weather,
): Promise<number | 'skipped'> {
  if (mapId === S000_MAP_ID) return 'skipped';

  // self-heal: 실제 사용자 상태가 이 맵에 없으면 인덱스에서 제거
  const state = await getUserState(authId);
  if (!state || state.mapId !== mapId) {
    await removeSafariActive(authId, mapId);
    return 'skipped';
  }

  const targetMap = MasterData.getMap(mapId);
  if (!targetMap || targetMap.type !== 'safari') {
    await removeSafariActive(authId, mapId);
    return 'skipped';
  }

  // GET + PTTL 파이프라인으로 살아있는 wild만 집계 (stale 인덱스 자동 정리 포함).
  // listWildIds는 만료된 uid를 포함해서 개체수를 부풀릴 수 있으므로 쓰지 않는다.
  const liveWilds = await getAllWildsWithCleanup(authId, mapId);
  const liveCount = liveWilds.length;
  const max = targetMap.wild.max;
  if (liveCount >= max) return 'skipped';

  const need = max - liveCount;

  const newWilds = await generateWildBatch(Number(authId), mapId, need, timeOfDay, weather);
  if (newWilds.length === 0) return 'skipped';

  for (const w of newWilds) {
    const ttlSec = w.isShiny ? null : randomWildTtlSec();
    const expiresAt = await addWild(authId, mapId, w, ttlSec);
    w.expiresAt = expiresAt;
    await publishWildSpawn({ authId, mapId, wild: w });
  }

  return newWilds.length;
}

export function startWildSpawnLoop(): () => Promise<void> {
  let running = false;
  let stopped = false;

  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      await runWildSpawnCycle(CONCURRENCY);
    } catch (err) {
      logger.error('[WILD_SPAWN] cycle crashed:', err);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, SPAWN_TICK_MS);
  logger.info(`[WILD_SPAWN] Loop started: every ${SPAWN_TICK_MS}ms`);

  return async () => {
    stopped = true;
    clearInterval(timer);
    while (running) await new Promise((r) => setTimeout(r, 50));
  };
}

import {
  WeatherState,
  Weather,
  MasterData,
  getAllMapWeathers,
  setMapWeather,
  publishMapWeather,
  logger,
} from '@poposerver/lib';
import { pickWeighted } from '@poposerver/lib/utils/rng';

const MIN_MS = 5 * 60 * 1000;
const MAX_MS = 15 * 60 * 1000;
const TICK_MS = 1_000;

const WEATHER_TABLE: { weather: Weather; weight: number }[] = [
  { weather: Weather.SUNNY, weight: 70 },
  { weather: Weather.RAINY, weight: 20 },
  { weather: Weather.STORMY, weight: 5 },
  { weather: Weather.FOGGY, weight: 20 },
];

const WEATHER_POOL = WEATHER_TABLE.map((e) => e.weather);
const WEATHER_WEIGHTS = WEATHER_TABLE.map((e) => e.weight);

function pickWeather(): Weather {
  return pickWeighted(WEATHER_POOL, WEATHER_WEIGHTS);
}

function randomDuration(): number {
  return MIN_MS + Math.floor(Math.random() * (MAX_MS - MIN_MS + 1));
}

async function rollMap(mapId: string, now: number): Promise<WeatherState> {
  const state: WeatherState = {
    mapId,
    weather: pickWeather(),
    startedAt: now,
    duration: randomDuration(),
  };
  await setMapWeather(state);
  await publishMapWeather(state);
  return state;
}

export function startWeatherClock(): () => void {
  const cache = new Map<string, WeatherState>();
  let running = false;
  let stopped = false;

  void (async () => {
    const now = Date.now();
    const existing = await getAllMapWeathers();
    const maps = MasterData.getAllMaps();

    let revived = 0;
    let rolled = 0;
    for (const m of maps) {
      const e = existing[m.id];

      if (e && e.startedAt + e.duration > now) {
        cache.set(m.id, e);
        await publishMapWeather(e);
        revived++;
      } else {
        const next = await rollMap(m.id, now);
        cache.set(m.id, next);
        rolled++;
      }
    }
    logger.info(`[WEATHER] init done: revived=${revived} rolled=${rolled}`);
  })().catch((err) => logger.error('[WEATHER] init failed:', err));

  const timer = setInterval(async () => {
    if (running || stopped) return;
    running = true;
    try {
      const now = Date.now();
      for (const [mapId, state] of cache) {
        if (state.startedAt + state.duration <= now) {
          const next = await rollMap(mapId, now);
          cache.set(mapId, next);
          logger.info(
            `[WEATHER] ${mapId} → ${next.weather} (${Math.round(next.duration / 1000)}s)`,
          );
        }
      }
    } catch (err) {
      logger.error('[WEATHER] tick failed:', err);
    } finally {
      running = false;
    }
  }, TICK_MS);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

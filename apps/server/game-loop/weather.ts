import {
  WeatherState,
  Weather,
  MasterData,
  getMapWeather,
  loadStoredMapWeathers,
  restoreMapWeather,
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

function isAlive(state: WeatherState | null, now: number): state is WeatherState {
  return state !== null && state.startedAt + state.duration > now;
}

async function rollMap(mapId: string): Promise<WeatherState> {
  const state: WeatherState = {
    mapId,
    weather: pickWeather(),
    startedAt: Date.now(),
    duration: randomDuration(),
  };
  await setMapWeather(state);
  await publishMapWeather(state);
  return state;
}

async function reviveStored(): Promise<number> {
  const mapIds = MasterData.getAllMaps().map((m) => m.id);
  const stored = await loadStoredMapWeathers(mapIds);
  const now = Date.now();
  const alive = Object.values(stored).filter((e) => isAlive(e, now));
  alive.forEach((e) => restoreMapWeather(e));
  return alive.length;
}

async function rollDue(logEach: boolean): Promise<number> {
  const maps = MasterData.getAllMaps();
  let rolled = 0;
  for (let i = 0; i < maps.length; i += 1) {
    const mapId = maps[i].id;
    if (!isAlive(getMapWeather(mapId), Date.now())) {
      const next = await rollMap(mapId);
      rolled += 1;
      if (logEach) {
        logger.info(`[WEATHER] ${mapId} → ${next.weather} (${Math.round(next.duration / 1000)}s)`);
      }
    }
  }
  return rolled;
}

export async function initWeather(): Promise<void> {
  const revived = await reviveStored();
  const rolled = await rollDue(false);
  logger.info(`[WEATHER] init done: revived=${revived} rolled=${rolled}`);
}

export function startWeatherClock(): () => void {
  let running = false;
  let stopped = false;

  const timer = setInterval(async () => {
    if (running || stopped) return;
    running = true;
    try {
      await rollDue(true);
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

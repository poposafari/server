import { redis } from '../redis';
import { logger } from '../utils/logger';
import { WeatherState } from './types';

const KEY_PREFIX = 'weather:';

const weathers = new Map<string, WeatherState>();

function parseWeather(mapId: string, raw: string): WeatherState | null {
  try {
    const v = JSON.parse(raw) as Partial<WeatherState>;
    if (
      v.mapId === mapId &&
      typeof v.weather === 'string' &&
      typeof v.startedAt === 'number' &&
      typeof v.duration === 'number'
    ) {
      return { mapId, weather: v.weather, startedAt: v.startedAt, duration: v.duration };
    }
  } catch {
    return null;
  }
  return null;
}

export function getMapWeather(mapId: string): WeatherState | null {
  return weathers.get(mapId) ?? null;
}

export function getAllMapWeathers(): Record<string, WeatherState> {
  return Object.fromEntries(weathers);
}

export async function loadStoredMapWeathers(
  mapIds: string[],
): Promise<Record<string, WeatherState>> {
  if (mapIds.length === 0) return {};
  const raws = await redis.mget(mapIds.map((id) => KEY_PREFIX + id));
  const out: Record<string, WeatherState> = {};
  raws.forEach((raw, i) => {
    if (raw === null) return;
    const mapId = mapIds[i];
    const state = parseWeather(mapId, raw);
    if (state) out[mapId] = state;
    else logger.warn(`[WEATHER] ignored invalid stored value for ${mapId}`);
  });
  return out;
}

export function restoreMapWeather(state: WeatherState): void {
  weathers.set(state.mapId, state);
}

export async function setMapWeather(state: WeatherState): Promise<void> {
  await redis.set(
    KEY_PREFIX + state.mapId,
    JSON.stringify(state),
    'PXAT',
    state.startedAt + state.duration,
  );
  weathers.set(state.mapId, state);
}

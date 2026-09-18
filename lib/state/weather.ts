import { WeatherState } from './types';

const weathers = new Map<string, WeatherState>();

export async function getMapWeather(mapId: string): Promise<WeatherState | null> {
  return weathers.get(mapId) ?? null;
}

export async function getAllMapWeathers(): Promise<Record<string, WeatherState>> {
  const out: Record<string, WeatherState> = {};
  for (const [mapId, state] of weathers) out[mapId] = state;
  return out;
}

export async function setMapWeather(state: WeatherState): Promise<void> {
  weathers.set(state.mapId, state);
}

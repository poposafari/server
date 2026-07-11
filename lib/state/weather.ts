// 날씨 — 힙 스토어. 재시작 시 게임 루프가 재추첨. (구 Redis weather:state 해시)

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

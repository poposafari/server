import { RedisStore, RedisKeys } from '@poposerver/shared';
import { RandomPicker } from '../utils/random-picker';

export type WeatherType = 'sunny' | 'rainy' | 'stormy' | 'snowy' | 'windy';

const WEATHERS: WeatherType[] = ['sunny', 'rainy', 'stormy', 'snowy', 'windy'];

export class WeatherService {
  public async getOrUpdateWeather(mapId: string): Promise<WeatherType> {
    const key = RedisKeys.mapWeather(mapId);
    const cached = await RedisStore.getJson<{ type: WeatherType; expiresAt: number }>(key);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.type;
    }

    const newWeather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];

    // 날씨 지속 시간: 30분 ~ 2시간 랜덤하게 바뀜.
    const durationMin = 30 + Math.floor(Math.random() * 90);
    const expiresAt = Date.now() + durationMin * 60 * 1000;

    await RedisStore.setJson(key, { type: newWeather, expiresAt });

    // TODO : 날씨 변경 알림 발행
    RedisStore.getClient().publish(
      RedisKeys.weatherChannel,
      JSON.stringify({
        mapId,
        weather: newWeather,
        expiresAt,
      }),
    );

    console.log(`[Weather] Map ${mapId} changed to ${newWeather} (for ${durationMin}m)`);
    return newWeather;
  }
}

export const WeatherManager = new WeatherService();

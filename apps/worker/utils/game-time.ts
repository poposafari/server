// apps/worker/src/utils/game-time.ts

import { TimeOfDay, Weather } from '@poposerver/shared/types/etc.type';

export const GameTime = {
  getCurrentState: (): { weather: Weather; time: TimeOfDay } => {
    // TODO: 나중에 실제 시간 흐름 로직 구현 (4시간마다 계절 변경하게 하면 ㄱㅊ을듯?)
    return {
      weather: Weather.SUNNY,
      time: TimeOfDay.DAY,
    };
  },

  getSpawnKey: (weather: Weather, time: TimeOfDay): string => {
    const weatherCap = weather.charAt(0).toUpperCase() + weather.slice(1);
    const timeCap = time.charAt(0).toUpperCase() + time.slice(1);
    return `wild${weatherCap}${timeCap}`;
  },
};

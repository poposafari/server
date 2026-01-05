export const RedisKeys = {
  globalTime: 'global:time',

  mapWeather: (mapId: string) => `map:${mapId}:weather`,
  mapWilds: (mapId: string) => `map:${mapId}:wilds`,
  mapItems: (mapId: string) => `map:${mapId}:items`,
  wildData: (wildId: string) => `wild:${wildId}:data`,
  itemData: (dropId: string) => `item:${dropId}:data`,
  userSession: (userId: number | string) => `user:${userId}:session`,

  // --- Channels (Pub/Sub) ---
  spawnChannel: 'channel:spawn_event',
  timeChannel: 'channel:time_event', // 시간 변경 알림용으로 쓸거임.ㅇㅇ
  weatherChannel: 'channel:weather_event', // 날씨 변경 알림용으로 쓸거임.ㅇㅇ
} as const;

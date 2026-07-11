// 힙/Postgres seam이 공유하는 상태 타입. (구 lib/redis.ts의 인터페이스를 이관)

export interface UserState {
  mapId: string;
  x: string;
  y: string;
  nickname: string;
  gender: string;
  costume: string;
  socketId: string;
  'pet:pokedexId': string;
  'pet:isShiny': string;
  createdAt: string;
  lastMoveTime: string;
  visitedMaps: string;
}

export type RoomMemberState = { userId: string } & UserState;

export interface GameTimeState {
  phase: string;
  startedAt: number; // 시작 시간(ms)
  duration: number; // 전체 시간(ms)
}

export interface WeatherState {
  mapId: string;
  weather: string;
  startedAt: number;
  duration: number;
}

export interface SafariWild {
  uid: string;
  pokedexId: string;
  level: number;
  gender: number;
  isShiny: boolean;
  nature: string;
  ability: string;
  caught: number; // 0=WILD, 1=CAUGHT, 2=FLED
  bait: boolean;
  rock: boolean;
  caughtCount: number;
  expiresAt?: number;
}

export interface SafariItem {
  uid: string;
  itemId: string;
  picked: boolean;
}

export type WildDespawnReason = 'ttl' | 'caught' | 'fled' | 'exit';

export interface WildSpawnMessage {
  authId: string;
  mapId: string;
  wild: SafariWild;
}

export interface WildDespawnMessage {
  authId: string;
  mapId: string;
  wildUid: string;
  reason: WildDespawnReason;
}

export type OAuthProviderName = 'google' | 'discord';

export const SAFARI_WILD_TTL_MIN_SEC = 90;
export const SAFARI_WILD_TTL_MAX_SEC = 300;

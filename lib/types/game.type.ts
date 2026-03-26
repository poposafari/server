// --- Global System types ---
export const GLOBAL_NICKNAME_REGEX = /^[\p{L}\p{N}]+$/u;
// --- Audit types ---
export enum AuditAction {
  NONE = 'NONE',
  REGISTER_LOCAL = 'REGISTER_LOCAL',
  LOGIN_LOCAL = 'LOGIN_LOCAL',
  DELETE_AUTH = 'DELETE_AUTH',
  LOGOUT = 'LOGOUT',
  CREATE_USER = 'CREATE_USER',
}

// --- Game Global types ---
export enum Weather {
  SUNNY = 'sunny',
  RAINY = 'rainy',
  STORMY = 'stormy',
  SNOWY = 'snowy',
  WINDY = 'windy',
}

export enum TimeOfDay {
  DAWN = 'dawn',
  DAY = 'day',
  DUSK = 'dusk',
  NIGHT = 'night',
}

// --- Item types ---
export type ItemCategory = 'pokeball' | 'berry' | 'key' | 'tms_hms' | 'etc';
export type ItemTier = 'common' | 'rare' | 'epic' | 'legendary';

export interface ItemData {
  id: string;
  buy: number;
  category: ItemCategory;
  comment: string;
  purchasable: boolean;
  sell: number;
  sellable: boolean;
  spawnMax: number;
  spawnRate: number;
  spawnable: boolean;
  tier: ItemTier;
}

// --- Map types ---
export type MapType = 'plaza' | 'safari';

export enum MapWildState {
  IDLE = 'IDLE',
  BATTLE = 'BATTLE',
  DEAD = 'DEAD',
  MOVING = 'MOVING',
}

export interface MapData {
  id: string;
  comment: string;
  cost: number;
  itemMax: number;
  itemSpawn: string[];
  type: MapType;
  wildMax: number;
  wildSunnyDawn: string[];
  wildSunnyDay: string[];
  wildSunnyDusk: string[];
  wildSunnyNight: string[];
  wildRainyDawn: string[];
  wildRainyDay: string[];
  wildRainyDusk: string[];
  wildRainyNight: string[];
  wildStormyDawn: string[];
  wildStormyDay: string[];
  wildStormyDusk: string[];
  wildStormyNight: string[];
  wildSnowyDawn: string[];
  wildSnowyDay: string[];
  wildSnowyDusk: string[];
  wildSnowyNight: string[];
  wildWindyDawn: string[];
  wildWindyDay: string[];
  wildWindyDusk: string[];
  wildWindyNight: string[];
}

// --- Pokemon types ---
export type PokemonTier = 'common' | 'rare' | 'epic' | 'legendary' | 'mythical';
export type PokemonSpawnTile = 'land' | 'water';
export type PokemonType =
  | 'normal'
  | 'fire'
  | 'water'
  | 'electric'
  | 'grass'
  | 'ice'
  | 'fighting'
  | 'poison'
  | 'ground'
  | 'flying'
  | 'psychic'
  | 'bug'
  | 'rock'
  | 'ghost'
  | 'dragon'
  | 'dark'
  | 'steel'
  | 'fairy';

export enum PokemonGender {
  NONE = 0,
  MALE = 1,
  FEMALE = 2,
}

export enum PokemonRegion {
  NONE = '',
  ALOLA = 'alola',
  GALAR = 'galar',
  HISUI = 'hisui',
  PALDEA = 'paldea',
}

export interface PokemonData {
  id: string;
  ability: string[];
  comment: string;
  evolCost: string[];
  evolNext: string[];
  formCost: string[];
  formNext: string[];
  generation: number;
  heightM: number;
  rateCapture: number;
  rateFemale: number;
  rateFlee: number;
  rateMale: number;
  rateSpawn: number;
  skills: string[];
  spawn: PokemonSpawnTile[];
  tier: PokemonTier;
  type1: PokemonType;
  type2: PokemonType | null;
  weightKg: number;
}

// --- Pokedex types ---
export enum PokedexStatus {
  SEEN,
  CAUGHT,
}

// --- User types ---
export const UserStartLocation: UserLocationData = { map: 'p001', x: 37, y: 32 };
export const UserAvatarParts: (keyof UserCostumeData)[] = ['skin', 'hair', 'hairColor', 'outfit'];
export type UserGender = 'male' | 'female';

export interface UserLocationData {
  map: string;
  x: number;
  y: number;
}

export interface UserCostumeData {
  skin: string;
  hair: string;
  hairColor: string;
  outfit: string;
}

export interface UserPcSettingsData {
  background: [number, number][];
  name: [number, string][];
}

export enum UserAuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  DISCORD = 'discord',
}

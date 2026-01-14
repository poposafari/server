// --- Audit types ---
export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  REGISTER = 'REGISTER',
  CATCH = 'CATCH',
  BUY = 'BUY',
  SELL = 'SELL',
  USE_ITEM = 'USE_ITEM',
  GET_ITEM = 'GET_ITEM',
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
export type PokemonGender = 'male' | 'female' | 'none';

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
export interface UserLocationData {
  map: string;
  x: number;
  y: number;
}

export interface UserAvatarData {
  skin: number;
  eye: number;
  hair: number;
  top: number;
  bottom: number;
  shoes: number;
  etc_1: number;
  etc_2: number;
  etc_3: number;
}

export interface UserPcSettingsData {
  background: [number, number][]; // [[boxId, backgroundId], ...]
  name: [number, string][]; // [[boxId, "BoxName"], ...]
}

export enum UserAuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  DISCORD = 'discord',
}

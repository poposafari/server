// --- Global System types ---
export const GLOBAL_NICKNAME_REGEX = /^[\p{L}\p{N}]+$/u;

// --- Game Global types ---
export enum Weather {
  SUNNY = 'sunny',
  RAINY = 'rainy',
  STORMY = 'stormy',
  FOGGY = 'foggy',
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
export type ItemCategory = 'pokeball' | 'berry' | 'key' | 'tms_hms' | 'etc' | 'sellable';
export type ItemTier = 'common' | 'rare' | 'epic' | 'legendary';

export interface ItemData {
  id: string;
  buy: number;
  category: ItemCategory;
  comment: string;
  purchasable: boolean;
  sell: number;
  sellable: boolean;
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

export interface MapWildEntry {
  id: string;
  weight: number;
  levelMin: number;
  levelMax: number;
}

export interface MapWildWeather {
  sunny: MapWildEntry[];
  rainy: MapWildEntry[];
  stormy: MapWildEntry[];
  foggy: MapWildEntry[];
}

export interface MapWildData {
  max: number;
  dawn: MapWildWeather;
  day: MapWildWeather;
  dusk: MapWildWeather;
  night: MapWildWeather;
}

export interface MapItemEntry {
  id: string;
  weight: number;
}

export interface MapItemData {
  min: number;
  max: number;
  spawn: MapItemEntry[];
}

export interface MapData {
  id: string;
  comment: string;
  type: MapType;
  cost: number;
  item: MapItemData;
  wild: MapWildData;
  entry: { x: number; y: number } | null;
}

// --- Pokemon types ---
export type PokemonTier =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'super-rare'
  | 'ultra-rare'
  | 'epic'
  | 'unique'
  | 'legendary';
export type PokemonSpawnTile = 'land' | 'water';
export type GrowthGroup =
  | 'fast'
  | 'medium_fast'
  | 'medium_slow'
  | 'slow'
  | 'erratic'
  | 'fluctuating';
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

export const PokemonNatural = [
  'lonely',
  'adamant',
  'naughty',
  'brave',
  'bold',
  'impish',
  'lax',
  'relaxed',
  'modest',
  'mild',
  'rash',
  'quiet',
  'calm',
  'gentle',
  'careful',
  'sassy',
  'timid',
  'hasty',
  'jolly',
  'naive',
  'bashful',
  'hardy',
  'docile',
  'quirky',
  'serious',
];

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
  skills: string[];
  spawn: PokemonSpawnTile[];
  tier: PokemonTier;
  type1: PokemonType;
  type2: PokemonType | null;
  weightKg: number;
  growthGroup: GrowthGroup;
  baseExp: number;
}

// --- Pokedex types ---
export enum PokedexStatus {
  SEEN,
  CAUGHT,
}

export const UserStartLocation: UserLocationData = { map: 's000', x: 34, y: 34 };
export const UserAvatarParts: (keyof UserCostumeData)[] = ['skin', 'hair', 'outfit'];

export const S000_MAP_ID = 's000';
export const POST_S000_LOCATION: UserLocationData = { map: 'p001', x: 50, y: 30 };
export const S000_REWARD_ITEM_ID = 'safari-ball';
export const S000_REWARD_QUANTITY = 30;
export const S000_REWARD_TICKET_ID = 'safari-zone-ticket';
export const S000_REWARD_TICKET_QUANTITY = 5;
export const S000_STARTER_LEVEL = 5;

export const SAFARI_ENTRY_BALL_ID = 'safari-ball';
// 입장 시 무료 사파리볼 미지급(0). 볼은 상점 구매(buy-only) 모델. 티켓은 순수 입장권.
export const SAFARI_ENTRY_BALL_QUANTITY = 0;

export const STARTER_POKEDEX_IDS: readonly string[] = [
  '0001',
  '0004',
  '0007',
  '0152',
  '0155',
  '0158',
  '0252',
  '0255',
  '0258',
  '0387',
  '0390',
  '0393',
  '0495',
  '0498',
  '0501',
  '0650',
  '0653',
  '0656',
  '0722',
  '0725',
  '0728',
  '0810',
  '0813',
  '0816',
  '0906',
  '0909',
  '0912',
];
export type UserGender = 'male' | 'female';

export interface UserLocationData {
  map: string;
  x: number;
  y: number;
}

export interface UserCostumeData {
  skin: string;
  hair: string;
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

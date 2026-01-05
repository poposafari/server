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

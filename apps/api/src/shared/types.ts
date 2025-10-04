import { ItemCategory, OverworldType, PokemonGender, PokemonSkill, PokemonType, Rarity, WildSpawn } from './enums';

export type GameLogicRes<T = any> = { result: true; data: T };

export type Wild = {
  idx: number;
  pokedex: string;
  gender: PokemonGender;
  shiny: boolean;
  skills: PokemonSkill[];
  form: string;
  catch: boolean;
  eaten_berry: string | null;
  baseRate: number;
  type1: PokemonType;
  type2: PokemonType | null;
  rank: string;
  spawn: WildSpawn;
};

export type GroundItem = {
  idx: number;
  item: string;
  stock: number;
  catch: boolean;
};

export type Overworld = {
  comment: string;
  type: OverworldType;
  cost: number;
  spawnCount: number;
  spawn: string[];
};

export type NextEvol = {
  next: string | null;
  cost: number | string;
};

export type PokemonRate = {
  spawn: number;
  capture: number;
  flee: number;
};

export type Pokemon = {
  comment: string;
  nextEvol: NextEvol;
  rate: PokemonRate;
  rank: Rarity;
  type1: PokemonType;
  type2: PokemonType | null;
  spawn: WildSpawn[];
};

export type Item = {
  comment: string;
  type: ItemCategory;
  price: number;
  purchasable: boolean;
  spawnable: boolean;
  rate: number;
  maxground: number;
};

export type SpawnableItem = {
  item: string;
  rate: number;
  maxground: number;
};

export type CatchItem = {
  rate: number;
};

export type RewardItem = {
  item: string;
  rate: number;
  min: number;
  max: number;
};

export type RewardCandy = {
  min: number;
  max: number;
};

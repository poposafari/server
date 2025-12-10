import { ItemCategory, OverworldType, PokemonGender, PokemonSkill, PokemonType, Rarity, WildSpawn } from './enums';

export type GameLogicRes<T = any> = { result: true; data: T };
export const BaseGroundItemList: string[] = ['002', '003', '004', '011', '012', '013', '014', '015', '016', '017', '018', '019', '020', '021', '022', '023', '024', '025', '026', '027', '028', '029'];

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
  region: string;
};

export type GroundItem = {
  idx: number;
  item: string;
  stock: number;
  catch: boolean;
  rank: string;
};

export type Overworld = {
  comment: string;
  type: OverworldType;
  cost: number;
  wild: {
    count: number;
    spawn: {
      day: string[];
      dusk: string[];
      night: string[];
    };
  };
  groundItem: {
    count: number;
    spawn: string[];
  };
};

export type NextEvol = {
  next: string | null;
  cost: number | string;
};

export type PokemonRate = {
  spawn: number;
  capture: number;
  flee: number;
  male: number;
  female: number;
};

export type Pokemon = {
  comment: string;
  nextEvol: NextEvol;
  rate: PokemonRate;
  rank: Rarity;
  type1: PokemonType;
  type2: PokemonType | null;
  spawn: WildSpawn[];
  skill: PokemonSkill[];
  ability: string[];
};

export type Item = {
  comment: string;
  type: ItemCategory;
  buyPrice: number;
  sellPrice: number;
  purchasable: boolean;
  sellable: boolean;
  spawnable: boolean;
  rate: number;
  maxground: number;
  rank: Rarity;
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

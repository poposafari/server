import { PokemonGender, PokemonSkill } from './enums';

export interface RegisterLocalReq {
  username: string;
  password: string;
  email?: string;
}

export interface RegisterIngameReq {
  gender: 'boy' | 'girl';
  avatar: number;
  nickname: string;
  option: {
    textSpeed: number;
    frame: number;
    backgroundVolume: number;
    effectVolume: number;
    tutorial: boolean;
  };
}

export interface LoginLocalReq {
  username: string;
  password: string;
}

export interface AddItemReq {
  item: string;
  stock: number;
}

export interface BuyItemReq {
  item: string;
  stock: number;
}

export interface SellItemReq {
  item: string;
  stock: number;
}

export interface UseItemReq {
  item: string;
  cost: number;
}

export interface AddPcReq {
  pokedex: string;
  gender: PokemonGender;
  shiny: boolean;
  skill?: PokemonSkill; // optional: skill이 없으면 빈 배열 사용
  location: string;
  capture_ball: string;
  region: string;
}

export interface GetPcReq {
  box: number;
}

export interface MovePcReq {
  target: number;
  from: number;
  to: number;
}

export interface EvolvePcReq {
  idx: number;
  target: number;
  time: string | Date;
}

export interface EnterSafariZoneReq {
  overworld: string;
  time: 'dawn' | 'day' | 'dusk' | 'night';
  party: number[];
}

export interface CatchWildReq {
  idx: number;
  ball: string;
  berry: string | null;
  parties: number[];
}

export interface CatchGroundItemReq {
  idx: number;
}

export interface CatchStarterPokemonReq {
  idx: number;
}

export interface FeedWildEatenBerryReq {
  idx: number;
  berry: string;
}

export interface LearnSkillPcReq {
  idx: number;
  target: number;
}

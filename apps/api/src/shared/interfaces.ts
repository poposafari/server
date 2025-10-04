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

export interface UseItemReq {
  item: string;
  cost: number;
}

export interface AddPcReq {
  pokedex: string;
  gender: PokemonGender;
  shiny: boolean;
  form: string;
  skill: PokemonSkill;
  location: string;
  capture_ball: string;
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
  target: number;
}

export interface EnterSafariZoneReq {
  overworld: string;
}

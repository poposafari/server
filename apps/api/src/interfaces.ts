import { Backgrounds, ItemType, PokemonGender, PokemonSkill } from "./enums";

export interface LoginData {
  username: string;
  password: string;
}

export interface Item {
  item: string;
  stock: number;
}

export interface ItemSel {
  category: ItemType;
}

export interface RegisterReq {
  gender: "boy" | "girl";
  avatar: "1" | "2" | "3" | "4";
  nickname: string;
}

export interface SlotReq {
  data: (string | null)[];
}

export interface BoxBgReq {
  data: Backgrounds[];
}

export interface MyPokemonReq {
  pokedex: string;
  gender: PokemonGender;
  shiny: boolean;
  form: number;
  skill: PokemonSkill;
  location: string;
  capture_ball: string;
}

export interface PokeboxSelectReq {
  box?: number;
}

export interface MovePokemonBoxReq {
  pokedex: string;
  gender: PokemonGender;
  from: number;
  to: number;
}

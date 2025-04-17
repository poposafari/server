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

export interface ItemSlotData {
  slot1: string;
  slot2: string;
  slot3: string;
  slot4: string;
  slot5: string;
  slot6: string;
  slot7: string;
  slot8: string;
  slot9: string;
}

export interface PokeboxBgReq {
  box0: Backgrounds;
  box1: Backgrounds;
  box2: Backgrounds;
  box3: Backgrounds;
  box4: Backgrounds;
  box5: Backgrounds;
  box6: Backgrounds;
  box7: Backgrounds;
  box8: Backgrounds;
  box9: Backgrounds;
  box10: Backgrounds;
  box11: Backgrounds;
  box12: Backgrounds;
  box13: Backgrounds;
  box14: Backgrounds;
  box15: Backgrounds;
  box16: Backgrounds;
  box17: Backgrounds;
  box18: Backgrounds;
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
  box?: Backgrounds;
}

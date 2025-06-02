export const MAX_BOX_SIZE = 33;
export const MAX_PER_BOX = 63;
export const SaltOrRounds = 10;
export const MAX_STOCK = 999;
export const MAX_BUY = 99;
export const MAX_GROUNDITEM = 10;

export type GameLogicRes<T = any> = { success: true; data: T } | { success: false; reason: GameLogicErrorCode };

export enum ItemType {
  POKEBALL = "pokeball",
  KEY = "key",
  BERRY = "berry",
  ETC = "etc",
}

export enum IngameGender {
  BOY = "boy",
  GIRL = "girl",
}

export enum IngameAvatar {
  ONE = "1",
  TWO = "2",
  THREE = "3",
  FOUR = "4",
}

export enum Backgrounds {
  ZERO = "0",
  ONE = "1",
  TWO = "2",
  THREE = "3",
  FOUR = "4",
  FIVE = "5",
  SIX = "6",
  SEVEN = "7",
  EIGHT = "8",
  NINE = "9",
  TEN = "10",
  ELEVEN = "11",
  TWELVE = "12",
  THIRTEEN = "13",
  FOURTEEN = "14",
  FIFTEEN = "15",
}

export enum PokemonGender {
  MALE = "male",
  FEMALE = "female",
  NONE = "none",
}

export enum PokemonSkill {
  NONE = "none",
  SURF = "surf",
  DARK_EYES = "darkeyes",
}

export enum OverworldType {
  PLAZA = "plaza",
  SAFARI = "safari",
}

export const enum Type {
  NONE = "none",
  FIRE = "fire",
  WATER = "water",
  ELECTRIC = "electric",
  GRASS = "grass",
  ICE = "ice",
  FIGHT = "fight",
  POISON = "poison",
  GROUND = "ground",
  FLYING = "flying",
  PSYCHIC = "psychic",
  BUG = "bug",
  ROCK = "rock",
  GHOST = "ghost",
  DRAGON = "dragon",
  DARK = "dark",
  STEEL = "steel",
  FAIRY = "fairy",
  NORMAL = "normal",
}

export const enum Rarity {
  COMMON = "common",
  RARE = "rare",
  LEGENDARY = "legendary",
  MYTHICAL = "mythical",
}

export const enum GameLogicErrorCode {
  INSUFFICIENT_ITEM = "INSUFFICIENT_ITEM",
  NOT_FOUND_DATA = "NOT_FOUND_DATA",
  WRONG_REQUEST_STOCK = "WRONG_REQUEST_STOCK",
  MAX_STOCK = "MAX_STOCK",
  NOT_PURCHASABEE_ITEM = "NOT_PURCHASABEE_ITEM",
  NOT_ENOUGH_CANDY = "NOT_ENOUGH_CANDY",
  NOT_ENOUGH_STOCK = "NOT_ENOUGH_STOCK",
  NOT_ENOUGH_TICKET = "NOT_ENOUGH_TICKET",
  FULL_BOX = "FULL_BOX",
}

export const enum HttpErrorCode {
  ALREADY_EXIST_ACCOUNT = "ALREADY_EXIST_ACCOUNT",
  ALREADY_EXIST_NICKNAME = "ALREADY_EXIST_NICKNAME",
  LOGIN_FAIL = "LOGIN_FAIL",
  NOT_FOUND_ACCOUNT = "NOT_FOUND_ACCOUNT",
  NOT_FOUND_USER = "NOT_FOUND_USER",
  NOT_FOUND_TOKEN = "NOT_FOUND_TOKEN",
  INVALID_TOKEN = "INVALID_TOKEN",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  INVALID_REFRESH_TOKEN = "INVALID_REFRESH_TOKEN",
}

export interface AccountReq {
  username: string;
  password: string;
}

export interface ItemReq {
  item: string;
  stock: number;
}

export interface ItemCategoryReq {
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

export interface MovePokemonReq {
  pokedex: string;
  gender: PokemonGender;
  from: number;
  to: number;
}

export interface UseTicketReq {
  overworld: string;
}

export interface MoveToOverworldReq {
  overworld: string;
}

export interface Overworld {
  comment: string;
  type: OverworldType;
  cost: number;
  x: number;
  y: number;
  spawnCount: number;
  spawn: string[];
}

export interface NextEvol {
  next: string;
  cost: number | "string";
}

export interface Rate {
  spawn: number;
  capture: number;
}

export interface Pokemon {
  comment: string;
  nextEvol: NextEvol;
  rate: Rate;
  rank: Rarity;
  type1: Type;
  type2: Type | null;
}

export interface WildPokemon {
  pokedex: string;
  gender: PokemonGender;
  shiny: boolean;
  skills: PokemonSkill | null;
  form: number;
  catch: boolean;
}

export interface Item {
  comment: string;
  type: ItemType;
  price: number;
  purchasable: boolean;
  spawnable: boolean;
  rate: number;
  maxground: number;
}

export type SpawnableItem = {
  item: string;
  rate: number;
  maxground: number;
};

export type GroundItem = {
  item: string;
  stock: number;
  catch: boolean;
};

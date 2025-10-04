export const enum HttpErrorCode {
  NOT_FOUND_INGAME = 'NOT_FOUND_INGAME',
  NOT_FOUND_INGAME_ITEM = 'NOT_FOUND_INGAME_ITEM',
  NOT_FOUND_INGAME_ITEM_TYPE = 'NOT_FOUND_INGAME_ITEM_TYPE',
  INGAME_ITEM_STOCK_LIMIT_EXCEEDED = 'INGAME_ITEM_STOCK_LIMIT_EXCEEDED',
  ALREADY_EXIST_ACCOUNT = 'ALREADY_EXIST_ACCOUNT',
  ALREADY_EXIST_NICKNAME = 'ALREADY_EXIST_NICKNAME',
  LOGIN_FAIL = 'LOGIN_FAIL',
  NOT_FOUND_ACCOUNT = 'NOT_FOUND_ACCOUNT',
  NOT_FOUND_ACCESS_TOKEN = 'NOT_FOUND_ACCESS_TOKEN',
  NOT_FOUND_REFRESH_TOKEN = 'NOT_FOUND_REFRESH_TOKEN',
  NOT_FOUND_TOKEN = 'NOT_FOUND_TOKEN',
  INVALID_ACCESS_TOKEN = 'INVALID_ACCESS_TOKEN',
  INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN',
  INGAME_PC_IS_FULL = 'INGAME_PC_IS_FULL',
  NOT_FOUND_INGAME_PC = 'NOT_FOUND_INGAME_PC',
  NOT_FOUND_POKEMON_DATA = 'NOT_FOUND_POKEMON_DATA',
  NO_MORE_EVOLVE = 'NO_MORE_EVOLVE',
  NOT_ENOUGH_CANDY = 'NOT_ENOUGH_CANDY',
  NOT_PURCHASABLE_INGAME_ITEM = 'NOT_PURCHASABLE_INGAME_ITEM',
  NOT_FOUND_SAFARI_TICKET = 'NOT_FOUND_SAFARI_TICKET',
}

export enum SocialProviderType {
  GOOGLE = 'google',
  DISCORD = 'discord',
}

export enum ItemCategory {
  POKEBALL = 'pokeball',
  KEY = 'key',
  BERRY = 'berry',
  ETC = 'etc',
}

export enum PlayerGender {
  BOY = 'boy',
  GIRL = 'girl',
}

export enum PokemonGender {
  MALE = 'male',
  FEMALE = 'female',
  NONE = 'none',
}

export enum PokemonSkill {
  NONE = 'none',
  SURF = 'surf',
  DARK_EYES = 'dark_eyes',
}

export const enum PokemonType {
  NONE = 'none',
  FIRE = 'fire',
  WATER = 'water',
  ELECTRIC = 'electric',
  GRASS = 'grass',
  ICE = 'ice',
  FIGHT = 'fight',
  POISON = 'poison',
  GROUND = 'ground',
  FLYING = 'flying',
  PSYCHIC = 'psychic',
  BUG = 'bug',
  ROCK = 'rock',
  GHOST = 'ghost',
  DRAGON = 'dragon',
  DARK = 'dark',
  STEEL = 'steel',
  FAIRY = 'fairy',
  NORMAL = 'normal',
}

export const enum Rarity {
  COMMON = 'common',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

export enum WildSpawn {
  LAND = 'land',
  WATER = 'water',
}

export enum TextSpeed {
  SLOW = 0,
  MID = 1,
  FAST = 2,
}

export enum OverworldType {
  PLAZA = 'plaza',
  SAFARI = 'safari',
}

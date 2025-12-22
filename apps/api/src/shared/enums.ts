export const enum HttpErrorCode {
  NOT_FOUND_INGAME = 'NOT_FOUND_INGAME',
  NOT_FOUND_INGAME_ITEM = 'NOT_FOUND_INGAME_ITEM',
  NOT_FOUND_INGAME_ITEM_TYPE = 'NOT_FOUND_INGAME_ITEM_TYPE',
  INGAME_ITEM_STOCK_LIMIT_EXCEEDED = 'INGAME_ITEM_STOCK_LIMIT_EXCEEDED',
  ALREADY_EXIST_ACCOUNT = 'ALREADY_EXIST_ACCOUNT',
  ALREADY_EXIST_NICKNAME = 'ALREADY_EXIST_NICKNAME',
  FAIL_LOGIN = 'FAIL_LOGIN',
  NOT_FOUND_ACCOUNT = 'NOT_FOUND_ACCOUNT',
  NOT_FOUND_ACCESS_TOKEN = 'NOT_FOUND_ACCESS_TOKEN',
  NOT_FOUND_REFRESH_TOKEN = 'NOT_FOUND_REFRESH_TOKEN',
  NOT_FOUND_TOKEN = 'NOT_FOUND_TOKEN',
  INVALID_ACCESS_TOKEN = 'INVALID_ACCESS_TOKEN',
  INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN',
  INGAME_PC_IS_FULL = 'INGAME_PC_IS_FULL',
  INGAME_PC_SKILL_IS_FULL = 'INGAME_PC_SKILL_IS_FULL',
  INGAME_PC_SKILL_EXIST = 'INGAME_PC_SKILL_EXIST',
  NOT_FOUND_INGAME_PC = 'NOT_FOUND_INGAME_PC',
  NOT_FOUND_POKEMON_DATA = 'NOT_FOUND_POKEMON_DATA',
  NO_MORE_EVOLVE = 'NO_MORE_EVOLVE',
  NOT_ENOUGH_EVOLVE_CONDITION = 'NOT_ENOUGH_EVOLVE_CONDITION',
  NOT_ENOUGH_CANDY = 'NOT_ENOUGH_CANDY',
  NOT_ENOUGH_MONEY = 'NOT_ENOUGH_MONEY',
  NOT_PURCHASABLE_INGAME_ITEM = 'NOT_PURCHASABLE_INGAME_ITEM',
  NOT_SELLABLE_INGAME_ITEM = 'NOT_SELLABLE_INGAME_ITEM',
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
  TMs_HMs = 'tms_hms',
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
  CUT = 'move_cut',
  FLY = 'move_fly',
  SURF = 'move_surf',
  STRENGTH = 'move_strength',
  FLASH = 'move_flash',
  ROCK_SMASH = 'move_rock-smash',
  WATERFALL = 'move_waterfall',
  DIVE = 'move_dive',
  MEAN_LOOK = 'move_mean-look',
  DEFOG = 'move_defog',
  ANCIENT_POWER = 'move_ancient-power',
  DOUBLE_HIT = 'move_double-hit',
  DRAGON_PULSE = 'move_dragon-pulse',
  HYPER_DRILL = 'move_hyper-drill',
  MIMIC = 'move_mimic',
  ROLLOUT = 'move_rollout',
  STOMP = 'move_stomp',
  TAUNT = 'move_taunt',
  TWIN_BEAM = 'move_twin-beam',
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

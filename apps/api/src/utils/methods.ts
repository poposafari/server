import path from 'path';
import 'reflect-metadata';
import * as fs from 'fs';
import { redis } from '../data-source';
import { getCatchItemData, getItemData, getPokemonData, getRewardCandyData, getRewardData, ItemData, PokemonData, SpawnableItemTable } from '../store';
import { createAccessToken, createRefreshToken } from './jwt';
import {
  Backgrounds,
  GameLogicErrorCode,
  GameLogicRes,
  GroundItem,
  IngameAvatar,
  IngameGender,
  ItemCategoryReq,
  ItemType,
  MAX_BOX_SIZE,
  MAX_PER_BOX,
  PokemonGender,
  PokemonSkill,
  Rarity,
  SPAWN,
  SpawnableItem,
  Type,
  WildPokemon,
} from './type';

export const gameSuccess = <T>(data: T): GameLogicRes<T> => ({
  success: true,
  data: data,
});

export const gameFail = (reason: GameLogicErrorCode): GameLogicRes<null> => ({
  success: false,
  reason: reason,
});

export const createTokens = (user: number) => {
  const accessToken = createAccessToken({
    id: user,
  });

  const refreshToken = createRefreshToken({
    id: user,
  });

  redis.set(`refresh:${user}`, refreshToken, {
    EX: 60 * 60 * 24 * 7,
  });

  return accessToken;
};

export const getAvatarEnum = (value: string): IngameAvatar => {
  const found = Object.values(IngameAvatar).find((v) => v === value);
  if (!found) throw new Error('Invalid avatar value');
  return found as IngameAvatar;
};

export const getGenderEnum = (value: string): IngameGender => {
  const found = Object.values(IngameGender).find((v) => v === value);
  if (!found) throw new Error('Invalid gender value');
  return found as IngameGender;
};

export const getSpawnEnum = (value: string): SPAWN => {
  const found = Object.values(SPAWN).find((v) => v === value);
  if (!found) throw new Error('Invalid SPAWN');
  return found as SPAWN;
};

export const setDefaultBoxes = (): Backgrounds[] => {
  let ret: Backgrounds[] = [];

  for (let i = 0; i < MAX_BOX_SIZE; i++) {
    ret.push(Backgrounds.ZERO);
  }

  return ret;
};

export const setDefaultBoxesCnt = (): number[] => {
  let ret: number[] = [];

  for (let i = 0; i < MAX_BOX_SIZE; i++) {
    ret.push(0);
  }

  return ret;
};

export const getNextPokeboxIndex = (ingameBoxesCnt: number[]): number[] => {
  let ret: number[] = [-1, -1];

  for (let i = 0; i < MAX_BOX_SIZE; i++) {
    if (ingameBoxesCnt[i] >= 0 && ingameBoxesCnt[i] < MAX_PER_BOX) {
      ret[0] = i;
      ret[1] = ingameBoxesCnt[i];
      break;
    }
  }

  return ret;
};

export const getRandomGender = (): PokemonGender.FEMALE | PokemonGender.MALE => {
  return Math.random() < 0.5 ? PokemonGender.FEMALE : PokemonGender.MALE;
};

export const getShinyRandom = (): boolean => {
  return Math.random() < 1 / 512;
};

export const getRandomSpawn = (pokedex: string): SPAWN => {
  const pokemon = PokemonData[pokedex];

  if (pokemon && Array.isArray(pokemon.spawn) && pokemon.spawn.length > 0) {
    const randomIndex = Math.floor(Math.random() * pokemon.spawn.length);
    return pokemon.spawn[randomIndex];
  }

  return SPAWN.LAND;
};

export const getWildSpawnTable = (spawns: string[], count: number) => {
  const ret: string[] = [];
  const target: { pokedex: string; rate: number }[] = [];

  for (const pokedex of spawns) {
    const pokemon = PokemonData[pokedex];
    if (pokemon) {
      const rate = pokemon.rate.spawn ?? 0;
      if (rate > 0) {
        target.push({ pokedex, rate });
      }
    }
  }

  const total = target.reduce((sum, pokemon) => sum + pokemon.rate, 0);
  if (total <= 0) return [];

  for (let i = 0; i < count; i++) {
    const random = Math.random() * total;
    let acc = 0;

    for (const pokemon of target) {
      acc += pokemon.rate;
      if (random < acc) {
        ret.push(pokemon.pokedex);
        break;
      }
    }
  }

  return ret;
};

export const getSpawnableItemTable = (): SpawnableItem[] => {
  const result: SpawnableItem[] = [];

  for (const key in ItemData) {
    const item = ItemData[key];
    if (item.spawnable) {
      result.push({
        item: key,
        rate: item.rate,
        maxground: item.maxground,
      });
    }
  }

  return result;
};

export const getGroundItems = (count: number): GroundItem[] => {
  const ret: GroundItem[] = [];
  const totalRate = SpawnableItemTable.reduce((sum, item) => sum + item.rate, 0);

  for (let i = 0; i < count; i++) {
    const rand = Math.floor(Math.random() * totalRate);
    let acc = 0;

    for (const item of SpawnableItemTable) {
      acc += item.rate;
      if (rand <= acc) {
        const stock = Math.floor(Math.random() * item.maxground) + 1;
        ret.push({ idx: -1, item: item.item, stock, catch: false });
        break;
      }
    }
  }

  return ret;
};

export const getWildPokemons = (pokedexs: string[]): WildPokemon[] => {
  const ret: WildPokemon[] = [];

  for (const pokedex of pokedexs) {
    const pokemonData = getPokemonData(pokedex);
    const baseRate = pokemonData.rate.capture;
    const rank = pokemonData.rank;

    ret.push({
      idx: -1,
      pokedex: pokedex,
      gender: getRandomGender(),
      shiny: getShinyRandom(),
      skills: PokemonSkill.NONE,
      form: 0,
      catch: false,
      eaten_berry: null,
      baseRate: baseRate,
      rank: rank,
      spawns: getRandomSpawn(pokedex),
    });
  }

  return ret;
};

export const getRandomReward = (rarity: Rarity) => {
  const rewards = getRewardData(rarity);
  const totalRate = rewards.reduce((sum, r) => sum + r.rate, 0);
  const roll = Math.random() * totalRate;

  let acc = 0;
  for (const reward of rewards) {
    acc += reward.rate;
    if (roll <= acc) {
      const stock = reward.min + Math.floor(Math.random() * (reward.max - reward.min + 1));
      const category = getItemData(reward.item).type;
      return { item: reward.item, stock: stock, category: category };
    }
  }
};

export const getRandomRewards = (rarity: Rarity) => {
  const result: { item: string; stock: number; category: ItemType }[] = [];
  const count = Math.floor(Math.random() * 4);

  for (let i = 0; i < count; i++) {
    const reward = getRandomReward(rarity);

    if (reward) result.push(reward);
  }

  return result;
};

export const getRandomCandyReward = (rarity: Rarity) => {
  const reward = getRewardCandyData(rarity);
  const candy = reward.min + Math.floor(Math.random() * (reward.max - reward.min + 1));

  return candy;
};

export const readJson = (file: string) => {
  const name = '../../' + file + '.json';
  const filePath = path.resolve(__dirname, name);
  const rawData = fs.readFileSync(filePath, 'utf-8');

  return JSON.parse(rawData);
};

export const matchTypeWithBerryRate = (berry: string | null, type1: Type, type2: Type | null) => {
  if (!berry) return 1.0;

  const rate = getCatchItemData(berry).rate;

  switch (berry) {
    case '011':
      if ([type1, type2].includes(Type.FIRE)) return rate;
    case '012':
      if ([type1, type2].includes(Type.WATER)) return rate;
    case '013':
      if ([type1, type2].includes(Type.ELECTRIC)) return rate;
    case '014':
      if ([type1, type2].includes(Type.GRASS)) return rate;
    case '015':
      if ([type1, type2].includes(Type.ICE)) return rate;
    case '016':
      if ([type1, type2].includes(Type.FIGHT)) return rate;
    case '017':
      if ([type1, type2].includes(Type.POISON)) return rate;
    case '018':
      if ([type1, type2].includes(Type.GROUND)) return rate;
    case '019':
      if ([type1, type2].includes(Type.FLYING)) return rate;
    case '020':
      if ([type1, type2].includes(Type.PSYCHIC)) return rate;
    case '021':
      if ([type1, type2].includes(Type.BUG)) return rate;
    case '022':
      if ([type1, type2].includes(Type.ROCK)) return rate;
    case '023':
      if ([type1, type2].includes(Type.GHOST)) return rate;
    case '024':
      if ([type1, type2].includes(Type.DRAGON)) return rate;
    case '025':
      if ([type1, type2].includes(Type.DARK)) return rate;
    case '026':
      if ([type1, type2].includes(Type.STEEL)) return rate;
    case '027':
      if ([type1, type2].includes(Type.FAIRY)) return rate;
    case '028':
      if ([type1, type2].includes(Type.NORMAL)) return rate;
    case '029':
      return rate;
    default:
      return 1.0;
  }
};

export const matchPokemonWithRarityRate = (rank: Rarity) => {
  let rate = 1.0;

  switch (rank) {
    case Rarity.RARE:
      rate = 1.2;
    case Rarity.EPIC:
      rate = 1.5;
    case Rarity.LEGENDARY:
      rate = 2.0;
  }

  return rate;
};

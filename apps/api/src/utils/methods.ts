import path from 'path';
import 'reflect-metadata';
import * as fs from 'fs';
import { redis } from '../data-source';
import { getCatchItemData, getItemData, getPokemonData, getRewardCandyData, getRewardData, ItemData, PokemonData, SpawnableItemTable } from '../shared/data';
import { createAccessToken, createRefreshToken } from './jwt';
import { BaseGroundItemList, GameLogicRes, GroundItem, SpawnableItem, Wild } from '../shared/types';
import { MAX_BOX_SIZE, MAX_PER_BOX } from '../shared/constants';
import { ItemCategory, PlayerGender, PokemonGender, PokemonSkill, PokemonType, Rarity, WildSpawn } from '../shared/enums';

export const gameSuccess = <T>(data: T): GameLogicRes<T> => ({
  result: true,
  data: data,
});

export const createTokens = (user: number, type: 'access' | 'refresh') => {
  let token = null;

  if (type === 'access') {
    token = createAccessToken({
      id: user,
    });
  }

  if (type === 'refresh') {
    token = createRefreshToken({
      id: user,
    });

    redis.set(`refresh:${user}`, token, {
      EX: 60 * 60 * 24 * 7,
    });
  }

  return token;
};

export const getGenderEnum = (value: string): PlayerGender => {
  const found = Object.values(PlayerGender).find((v) => v === value);
  if (!found) throw new Error('Invalid gender value');
  return found as PlayerGender;
};

export const setDefaultBoxesCnt = (): number[] => {
  let ret: number[] = [];

  for (let i = 0; i < MAX_BOX_SIZE; i++) {
    ret.push(0);
  }

  return ret;
};

export const getNextPcBoxNum = (ingameBoxesCnt: number[]): number[] => {
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

export const getRandomSpawn = (pokedex: string): WildSpawn => {
  const pokemon = PokemonData[pokedex];

  if (pokemon && Array.isArray(pokemon.spawn) && pokemon.spawn.length > 0) {
    const randomIndex = Math.floor(Math.random() * pokemon.spawn.length);
    return pokemon.spawn[randomIndex];
  }

  return WildSpawn.LAND;
};

export const getRandomWildPokedex = (spawns: string[], count: number) => {
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

export const getWildSpawnTable = (safari: string, spawns: string[], count: number) => {
  if (safari === 'lab') {
    return spawns;
  } else {
    return getRandomWildPokedex(spawns, count);
  }
};

export const getRandomGroundItems = (spawns: string[], count: number) => {
  const ret: string[] = [];
  const target: { item: string; rate: number }[] = [];
  const expandedSpawns: string[] = [];

  for (const spawn of spawns) {
    if (spawn === 'base') {
      expandedSpawns.push(...BaseGroundItemList);
    } else {
      expandedSpawns.push(spawn);
    }
  }

  for (const itemCode of expandedSpawns) {
    const item = ItemData[itemCode];
    if (item) {
      const rate = item.rate ?? 0;
      if (rate > 0) {
        target.push({ item: itemCode, rate });
      }
    }
  }

  const total = target.reduce((sum, item) => sum + item.rate, 0);
  if (total <= 0) return [];

  for (let i = 0; i < count; i++) {
    const random = Math.random() * total;
    let acc = 0;

    for (const item of target) {
      acc += item.rate;
      if (random < acc) {
        ret.push(item.item);
        break;
      }
    }
  }

  return ret;
};

export const getGroundItemSpawnTable = (safari: string, spawns: string[], count: number): string[] => {
  if (safari === 'lab') {
    return spawns;
  } else {
    return getRandomGroundItems(spawns, count);
  }
};

export const getGroundItemsFromCodes = (itemCodes: string[]): GroundItem[] => {
  const ret: GroundItem[] = [];

  for (const itemCode of itemCodes) {
    const itemData = getItemData(itemCode);
    const stock = Math.floor(Math.random() * itemData.maxground) + 1;

    ret.push({
      idx: -1,
      item: itemCode,
      stock,
      catch: false,
      rank: itemData.rank,
    });
  }

  return ret;
};

export const getWildPokemons = (pokedexs: string[]): Wild[] => {
  const ret: Wild[] = [];

  for (const pokedex of pokedexs) {
    const pokemonData = getPokemonData(pokedex);
    const baseRate = pokemonData.rate.capture;
    const rank = pokemonData.rank;

    ret.push({
      idx: -1,
      pokedex: pokedex,
      gender: getRandomGender(),
      shiny: getShinyRandom(),
      skills: [],
      form: '',
      catch: false,
      eaten_berry: null,
      baseRate: baseRate,
      type1: pokemonData.type1,
      type2: pokemonData.type2,
      rank: rank,
      spawn: getRandomSpawn(pokedex),
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
  const result: { item: string; stock: number; category: ItemCategory }[] = [];

  let minCount = 0;
  let maxCount = 1;

  switch (rarity) {
    case Rarity.COMMON:
      minCount = 0;
      maxCount = 1;
      break;
    case Rarity.RARE:
      minCount = 1;
      maxCount = 2;
      break;
    case Rarity.EPIC:
      minCount = 2;
      maxCount = 3;
      break;
    case Rarity.LEGENDARY:
      minCount = 3;
      maxCount = 5;
      break;
  }

  const count = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));

  const itemMap = new Map<string, { stock: number; category: ItemCategory }>();

  for (let i = 0; i < count; i++) {
    const reward = getRandomReward(rarity);

    if (reward) {
      const existing = itemMap.get(reward.item);
      if (existing) {
        existing.stock += reward.stock;
      } else {
        itemMap.set(reward.item, { stock: reward.stock, category: reward.category });
      }
    }
  }

  itemMap.forEach((value, item) => {
    result.push({ item, stock: value.stock, category: value.category });
  });

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

export const matchTypeWithBerryRate = (berry: string | null, type1: PokemonType, type2: PokemonType | null) => {
  if (!berry) return 1.0;

  const rate = getCatchItemData(berry).rate;

  switch (berry) {
    case '011':
      if ([type1, type2].includes(PokemonType.FIRE)) return rate;
      break;
    case '012':
      if ([type1, type2].includes(PokemonType.WATER)) return rate;
      break;
    case '013':
      if ([type1, type2].includes(PokemonType.ELECTRIC)) return rate;
      break;
    case '014':
      if ([type1, type2].includes(PokemonType.GRASS)) return rate;
      break;
    case '015':
      if ([type1, type2].includes(PokemonType.ICE)) return rate;
      break;
    case '016':
      if ([type1, type2].includes(PokemonType.FIGHT)) return rate;
      break;
    case '017':
      if ([type1, type2].includes(PokemonType.POISON)) return rate;
      break;
    case '018':
      if ([type1, type2].includes(PokemonType.GROUND)) return rate;
      break;
    case '019':
      if ([type1, type2].includes(PokemonType.FLYING)) return rate;
      break;
    case '020':
      if ([type1, type2].includes(PokemonType.PSYCHIC)) return rate;
      break;
    case '021':
      if ([type1, type2].includes(PokemonType.BUG)) return rate;
      break;
    case '022':
      if ([type1, type2].includes(PokemonType.ROCK)) return rate;
      break;
    case '023':
      if ([type1, type2].includes(PokemonType.GHOST)) return rate;
      break;
    case '024':
      if ([type1, type2].includes(PokemonType.DRAGON)) return rate;
      break;
    case '025':
      if ([type1, type2].includes(PokemonType.DARK)) return rate;
      break;
    case '026':
      if ([type1, type2].includes(PokemonType.STEEL)) return rate;
      break;
    case '027':
      if ([type1, type2].includes(PokemonType.FAIRY)) return rate;
      break;
    case '028':
      if ([type1, type2].includes(PokemonType.NORMAL)) return rate;
      break;
    case '029':
      return rate;
      break;
  }

  return 1.0;
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

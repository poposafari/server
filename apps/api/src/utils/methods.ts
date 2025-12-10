import path from 'path';
import 'reflect-metadata';
import * as fs from 'fs';
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

export const getRandomGender = (male: number, female: number): PokemonGender.FEMALE | PokemonGender.MALE | PokemonGender.NONE => {
  // 두 값이 모두 0이면 NONE 반환
  if (male === 0 && female === 0) {
    return PokemonGender.NONE;
  }

  // 확률 합계 계산
  const total = male + female;

  // 합계가 0이면 NONE 반환 (안전장치)
  if (total === 0) {
    return PokemonGender.NONE;
  }

  // 0~1 사이의 랜덤 값 생성
  const random = Math.random() * total;

  // male 확률 범위 내에 있으면 MALE 반환
  if (random < male) {
    return PokemonGender.MALE;
  }

  // 그 외에는 FEMALE 반환
  return PokemonGender.FEMALE;
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

/**
 * 포획 횟수 총합에 따른 희귀도별 가중치 계산
 * @param totalCount 포획 횟수 총합
 * @param rarity 희귀도
 * @returns 가중치 (1.0 이상)
 */
export const getRarityWeight = (totalCount: number, rarity: Rarity): number => {
  const baseWeight = 1.0;

  // 포획 횟수를 0~1 범위로 정규화 (최대 500 기준)
  const normalizedCount = Math.min(totalCount / 500, 1.0);

  // 희귀도별 보너스 계수
  const rarityMultipliers: Record<Rarity, number> = {
    [Rarity.COMMON]: 0.0, // 변화 없음
    [Rarity.RARE]: 0.15, // 최대 15% 증가
    [Rarity.EPIC]: 0.3, // 최대 30% 증가
    [Rarity.LEGENDARY]: 0.5, // 최대 50% 증가
  };

  const bonus = normalizedCount * rarityMultipliers[rarity];
  return baseWeight + bonus;
};

export const getRandomWildPokedex = (spawns: string[], count: number, totalCaptureCount: number = 0) => {
  const ret: string[] = [];
  const target: { pokedex: string; rate: number }[] = [];

  for (const pokedex of spawns) {
    const pokemon = PokemonData[pokedex];
    if (pokemon) {
      let rate = pokemon.rate.spawn ?? 0;

      // 포획 횟수가 0보다 크면 희귀도 보너스 가중치 적용
      if (totalCaptureCount > 0 && rate > 0) {
        const rarityWeight = getRarityWeight(totalCaptureCount, pokemon.rank);
        rate = rate * rarityWeight;
      }

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

export const getWildSpawnTable = (safari: string, spawns: string[], count: number, totalCaptureCount: number = 0) => {
  if (safari === 'lab') {
    return spawns;
  } else {
    return getRandomWildPokedex(spawns, count, totalCaptureCount);
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

export const generateDespawnTime = (spawnTime: Date = new Date()): Date => {
  const minutesToAdd = 10 + Math.floor(Math.random() * 11);
  const despawnTime = new Date(spawnTime);
  despawnTime.setMinutes(despawnTime.getMinutes() + minutesToAdd);
  return despawnTime;
};

export const getWildPokemons = (pokedexs: string[], region: string = 'kanto'): Wild[] => {
  const ret: Wild[] = [];

  for (const pokedex of pokedexs) {
    const pokemonData = getPokemonData(pokedex);
    const baseRate = pokemonData.rate.capture;
    const rank = pokemonData.rank;
    const maleRate = pokemonData.rate.male ?? 0;
    const femaleRate = pokemonData.rate.female ?? 0;

    ret.push({
      idx: -1,
      pokedex: pokedex,
      gender: getRandomGender(maleRate, femaleRate),
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
      region: region,
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

export const matchTypeWithBallRate = (ball: string): number => {
  switch (ball) {
    case 'poke-ball':
      return 1.0;
    case 'great-ball':
      return 1.5;
    case 'ultra-ball':
      return 2.0;
    default:
      return 1.0;
  }
};

export const matchTypeWithBerryRate = (berry: string | null, type1: PokemonType, type2: PokemonType | null) => {
  if (!berry) return 1.0;

  const bonusRate = 1.05;

  switch (berry) {
    case 'occa-berry':
      if ([type1, type2].includes(PokemonType.FIRE)) return bonusRate;
      break;
    case 'passho-berry':
      if ([type1, type2].includes(PokemonType.WATER)) return bonusRate;
      break;
    case 'wacan-berry':
      if ([type1, type2].includes(PokemonType.ELECTRIC)) return bonusRate;
      break;
    case 'rindo-berry':
      if ([type1, type2].includes(PokemonType.GRASS)) return bonusRate;
      break;
    case 'yache-berry':
      if ([type1, type2].includes(PokemonType.ICE)) return bonusRate;
      break;
    case 'chople-berry':
      if ([type1, type2].includes(PokemonType.FIGHT)) return bonusRate;
      break;
    case 'kebia-berry':
      if ([type1, type2].includes(PokemonType.POISON)) return bonusRate;
      break;
    case 'shuca-berry':
      if ([type1, type2].includes(PokemonType.GROUND)) return bonusRate;
      break;
    case 'coba-berry':
      if ([type1, type2].includes(PokemonType.FLYING)) return bonusRate;
      break;
    case 'payapa-berry':
      if ([type1, type2].includes(PokemonType.PSYCHIC)) return bonusRate;
      break;
    case 'tanga-berry':
      if ([type1, type2].includes(PokemonType.BUG)) return bonusRate;
      break;
    case 'charti-berry':
      if ([type1, type2].includes(PokemonType.ROCK)) return bonusRate;
      break;
    case 'kasib-berry':
      if ([type1, type2].includes(PokemonType.GHOST)) return bonusRate;
      break;
    case 'haban-berry':
      if ([type1, type2].includes(PokemonType.DRAGON)) return bonusRate;
      break;
    case 'colbur-berry':
      if ([type1, type2].includes(PokemonType.DARK)) return bonusRate;
      break;
    case 'babiri-berry':
      if ([type1, type2].includes(PokemonType.STEEL)) return bonusRate;
      break;
    case 'roseli-berry':
      if ([type1, type2].includes(PokemonType.FAIRY)) return bonusRate;
      break;
    case 'chilan-berry':
      if ([type1, type2].includes(PokemonType.NORMAL)) return bonusRate;
      break;
    case 'enigma-berry':
      // 의문열매는 모든 타입에 적용
      return bonusRate;
  }

  return 1.0;
};

export const matchPokemonWithRarityRate = (rank: Rarity) => {
  switch (rank) {
    case Rarity.RARE:
      return 1.2;
    case Rarity.EPIC:
      return 1.5;
    case Rarity.LEGENDARY:
      return 2.0;
    default:
      return 1.0;
  }
};

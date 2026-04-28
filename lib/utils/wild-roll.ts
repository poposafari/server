import crypto from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { userPokedex } from '../schema';
import { SafariWild, SAFARI_WILD_TTL_MIN_SEC, SAFARI_WILD_TTL_MAX_SEC } from '../redis';
import {
  TimeOfDay,
  Weather,
  PokemonNatural,
  S000_MAP_ID,
  STARTER_POKEDEX_IDS,
  type MapWildWeather,
} from '../types';
import { MasterData } from './master-data';
import { LEVEL_CURVE } from '../constants/level-curve';
import { rollSafariShiny, rollGender, randomInt, pickWeightedMany, pickOne } from './rng';

export function randomWildTtlSec(): number {
  return randomInt(SAFARI_WILD_TTL_MIN_SEC, SAFARI_WILD_TTL_MAX_SEC);
}

/**
 * 사파리 맵의 wild 풀에서 count개를 롤링해 SafariWild[]를 생성.
 * Redis 쓰기 없이 pure하게 반환. 호출자가 addWild로 저장한다.
 *
 * @param accountId DB 조회용 (caughtCount 프리필)
 * @param mapId 대상 사파리 맵 id
 * @param count 생성 개수
 * @param userLevel wildLevelRange 계산용
 * @param timeOfDay wild 풀 선택
 * @param weather wild 풀 선택
 */
export async function generateWildBatch(
  accountId: number,
  mapId: string,
  count: number,
  userLevel: number,
  timeOfDay: TimeOfDay,
  weather: Weather,
): Promise<SafariWild[]> {
  if (count <= 0) return [];

  const targetMap = MasterData.getMap(mapId);
  if (!targetMap) return [];

  const selectedPokedexIds: string[] =
    mapId === S000_MAP_ID
      ? [...STARTER_POKEDEX_IDS]
      : (() => {
          const wildPool = targetMap.wild[timeOfDay]?.[weather as keyof MapWildWeather] ?? [];
          if (wildPool.length === 0) return [];
          const ids = wildPool.map((e) => e.id);
          const weights = wildPool.map((e) => e.weight);
          return pickWeightedMany<string>(ids, weights, count);
        })();

  if (selectedPokedexIds.length === 0) return [];

  const uniquePokedexIds = Array.from(new Set(selectedPokedexIds));
  const pokedexRows = uniquePokedexIds.length
    ? await db
        .select({
          pokedexId: userPokedex.pokedexId,
          caughtCount: userPokedex.caughtCount,
        })
        .from(userPokedex)
        .where(
          and(
            eq(userPokedex.accountId, accountId),
            inArray(userPokedex.pokedexId, uniquePokedexIds),
          ),
        )
    : [];
  const caughtCountMap = new Map(pokedexRows.map((r) => [r.pokedexId, r.caughtCount]));

  return selectedPokedexIds.map((pokedexId) => {
    const pokemonData = MasterData.getPokemon(pokedexId);
    const gender = pokemonData ? rollGender(pokemonData.rateMale, pokemonData.rateFemale) : 0;
    const nature = pickOne(PokemonNatural);
    const ability = pokemonData?.ability.length ? pickOne(pokemonData.ability) : '';
    const { min: wildMin, max: wildMax } = LEVEL_CURVE.wildLevelRange(userLevel);
    const wildLevel = randomInt(wildMin, wildMax);
    return {
      uid: crypto.randomUUID(),
      pokedexId,
      level: wildLevel,
      gender,
      isShiny: rollSafariShiny(),
      nature,
      ability,
      caught: 0,
      bait: false,
      rock: false,
      caughtCount: caughtCountMap.get(pokedexId) ?? 0,
    };
  });
}

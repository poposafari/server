/// <reference path="../types/seedrandom.d.ts" />
import seedrandom from 'seedrandom';
import { PokemonGender } from '../types';

/** [0, 1) 구간의 결정론적 난수를 반환하는 함수 타입 */
export type SeededRng = () => number;

/**
 * authId를 시드로 한 스타팅 포켓몬 전용 RNG.
 * 같은 authId면 항상 같은 난수 시퀀스가 나와, 30마리를 재현 가능하게 한다.
 */
export function createStartingRng(authId: string): SeededRng {
  const seed = getStartingSeed(authId);
  return seedrandom(seed.toString());
}

const SHINY_RATE = 4096;

/**
 * 시드 기반 RNG로 이로치 여부 판정 (1/4096).
 * 같은 rng 시퀀스에서 같은 순서로 호출하면 같은 결과.
 */
export function rollShinySeeded(rng: SeededRng): boolean {
  return Math.floor(rng() * SHINY_RATE) === 0;
}

/**
 * 시드 기반 RNG로 성별 판정.
 * rateMale, rateFemale는 마스터 데이터 비율 (0~1).
 */
export function rollGenderSeeded(
  rng: SeededRng,
  rateMale: number,
  rateFemale: number,
): PokemonGender {
  const maleInt = Math.round(rateMale * 100);
  const femaleInt = Math.round(rateFemale * 100);
  const total = maleInt + femaleInt;

  if (total === 0) return PokemonGender.NONE;

  const roll = Math.floor(rng() * total);
  return roll < maleInt ? PokemonGender.MALE : PokemonGender.FEMALE;
}

export function rollShiny(): boolean {
  // 구현이 단순하지만, Math.random()은 부동소수점이라서 이론적으로는 정확하게 1/4096이 아닐 수 있다.
  //   return Math.random() < 1 / SHINY_RATE;

  // [0,4096) 구간에서 정수 하나(0)만 골라서, 확률이 정확하게 1/4096이 된다.
  return Math.floor(Math.random() * SHINY_RATE) === 0;
}

const SAFARI_SHINY_RATE = 1024;

export function rollSafariShiny(): boolean {
  return Math.floor(Math.random() * SAFARI_SHINY_RATE) === 0;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pickRandom<T>(arr: T[], count: number): T[] {
  const result: T[] = [];
  for (let i = 0; i < count; i++) {
    result.push(arr[Math.floor(Math.random() * arr.length)]);
  }
  return result;
}

export function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function rollGender(male: number, female: number): PokemonGender {
  const maleInt = Math.round(male * 100);
  const femaleInt = Math.round(female * 100);
  const total = maleInt + femaleInt;

  if (total === 0) return PokemonGender.NONE;

  const roll = Math.floor(Math.random() * total);

  return roll < maleInt ? PokemonGender.MALE : PokemonGender.FEMALE;
}

//TODO: export const getStartingSeed = (authId: string) => {} <-- 이 방식은 별로인가?

export function getStartingSeed(authId: string) {
  const n = Number(authId);

  // TODO: Number.isSafeInteger(n) vs Number.isInteger(n) <-- 이건 뭔 차이지?
  if (Number.isSafeInteger(n) && n > 0) {
    return n;
  }

  // TODO: 이 코드의 의미는 무엇인가?
  let h = 0;
  for (let i = 0; i < authId.length; i++) {
    h = (h * 31 + authId.charCodeAt(i)) >>> 0;
  }
  return h || 1;
}

/**
 * 시드 + 인덱스로 해당 슬롯만 결정적으로 생성.
 */
// TODO: 아래 코드는 무슨 코드임?
// export function createSlotRng(seed: number, index: number): () => number {
//   let s = (seed ^ (index * 0x9e37_79b9)) >>> 0;
//   return function next(): number {
//     s = (s * 1664525 + 1013904223) >>> 0;
//     return s / 0xffff_ffff;
//   };
// }

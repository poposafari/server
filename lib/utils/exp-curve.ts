/**
 * 본가 포켓몬 6개 성장 그룹 누적 EXP 공식.
 * 출처: https://bulbapedia.bulbagarden.net/wiki/Experience
 */

import type { GrowthGroup } from '../types';
export type { GrowthGroup };

export const POKEMON_LEVEL_MIN = 1;
export const POKEMON_LEVEL_MAX = 100;

export const EXP_CANDY_VALUE: Record<string, number> = {
  'experience-candy-xs': 100,
  'experience-candy-s': 800,
  'experience-candy-m': 3_000,
  'experience-candy-l': 10_000,
  'experience-candy-xl': 30_000,
};

export function isExpCandyId(itemId: string): boolean {
  return Object.prototype.hasOwnProperty.call(EXP_CANDY_VALUE, itemId);
}

export function totalExpForLevel(level: number, group: GrowthGroup): number {
  const n = Math.max(POKEMON_LEVEL_MIN, Math.min(POKEMON_LEVEL_MAX, Math.floor(level)));
  if (n === 1) return 0;
  switch (group) {
    case 'fast':
      return Math.floor((4 * n ** 3) / 5);
    case 'medium_fast':
      return n ** 3;
    case 'medium_slow':
      return Math.floor((6 * n ** 3) / 5 - 15 * n ** 2 + 100 * n - 140);
    case 'slow':
      return Math.floor((5 * n ** 3) / 4);
    case 'erratic':
      return erraticTotal(n);
    case 'fluctuating':
      return fluctuatingTotal(n);
  }
}

function erraticTotal(n: number): number {
  if (n <= 50) return Math.floor((n ** 3 * (100 - n)) / 50);
  if (n <= 68) return Math.floor((n ** 3 * (150 - n)) / 100);
  if (n <= 98) return Math.floor((n ** 3 * Math.floor((1911 - 10 * n) / 3)) / 500);
  return Math.floor((n ** 3 * (160 - n)) / 100);
}

function fluctuatingTotal(n: number): number {
  if (n <= 15) return Math.floor((n ** 3 * (Math.floor((n + 1) / 3) + 24)) / 50);
  if (n <= 35) return Math.floor((n ** 3 * (n + 14)) / 50);
  return Math.floor((n ** 3 * (Math.floor(n / 2) + 32)) / 50);
}

export interface ExpProgress {
  /** 현재 레벨 도달 시 누적 EXP */
  current: number;
  /** 다음 레벨 도달 시 누적 EXP (만렙이면 current와 동일) */
  next: number;
  /** 다음 레벨까지 남은 EXP (만렙이면 0) */
  remaining: number;
}

export function expToNextLevel(exp: number, group: GrowthGroup): ExpProgress {
  const level = levelFromExp(exp, group);
  const current = totalExpForLevel(level, group);
  const next = level >= POKEMON_LEVEL_MAX ? current : totalExpForLevel(level + 1, group);
  return { current, next, remaining: Math.max(0, next - exp) };
}

/**
 * 누적 EXP로 현재 레벨을 역산.
 * totalExpForLevel(L) ≤ exp < totalExpForLevel(L+1)을 만족하는 최대 L.
 * 이진 탐색으로 O(log MAX).
 */
export function levelFromExp(exp: number, group: GrowthGroup): number {
  const safeExp = Math.max(0, Math.floor(exp));
  let lo = POKEMON_LEVEL_MIN;
  let hi = POKEMON_LEVEL_MAX;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (totalExpForLevel(mid, group) <= safeExp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * 캡쳐 성공 시 파티 멤버 1마리가 얻는 EXP (Gen 5+ 스케일링 변형).
 *   EXP = ⌊ (b × L) / (5 × s) × ((2L + 10)^1.5 / (L + Lp + 10)^1.5) + 1 ⌋
 * - b: 야생 포켓몬의 base experience yield
 * - L: 야생 포켓몬 레벨
 * - s: 분배 대상(파티 non-null) 수
 * - Lp: 받는 포켓몬 레벨
 *
 * 본가 지수는 2.5이나, 사파리는 캡쳐 빈도가 높고 6마리 풀 분배라
 * 저레벨 멤버 가속이 과해 1.5로 완화.
 */
export function calcCaptureExp(
  baseExp: number,
  wildLevel: number,
  participants: number,
  receiverLevel: number,
): number {
  if (baseExp <= 0 || wildLevel <= 0) return 0;
  const s = Math.max(1, Math.floor(participants));
  const L = Math.floor(wildLevel);
  const Lp = Math.max(1, Math.floor(receiverLevel));
  const scale = Math.pow(2 * L + 10, 1.5) / Math.pow(L + Lp + 10, 1.5);
  return Math.floor(((baseExp * L) / (5 * s)) * scale + 1);
}

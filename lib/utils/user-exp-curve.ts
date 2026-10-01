import {
  USER_CAPTURE_EXP_BY_TIER,
  USER_CAPTURE_EXP_EXPONENT,
  USER_DAILY_CAPTURE_STEPS,
  USER_EXP_CURVE_A,
  USER_EXP_CURVE_P,
  USER_LEVEL_MAX,
  USER_LEVEL_MIN,
} from '../constants/user-level';
import type { PokemonTier } from '../types';

export function userTotalExpForLevel(level: number): number {
  const n = Math.max(USER_LEVEL_MIN, Math.min(USER_LEVEL_MAX, Math.floor(level)));
  return Math.floor(USER_EXP_CURVE_A * (n - 1) ** USER_EXP_CURVE_P);
}

export const USER_EXP_MAX = userTotalExpForLevel(USER_LEVEL_MAX);

export function userLevelFromExp(exp: number): number {
  const safeExp = Math.max(0, Math.floor(exp));
  let lo = USER_LEVEL_MIN;
  let hi = USER_LEVEL_MAX;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (userTotalExpForLevel(mid) <= safeExp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export interface UserExpProgress {
  level: number;
  exp: number;
  expMax: number;
}

export function userExpProgress(exp: number): UserExpProgress {
  const safeExp = Math.max(0, Math.floor(exp));
  const level = userLevelFromExp(safeExp);
  if (level >= USER_LEVEL_MAX) return { level, exp: 0, expMax: 0 };
  const current = userTotalExpForLevel(level);
  return {
    level,
    exp: safeExp - current,
    expMax: userTotalExpForLevel(level + 1) - current,
  };
}

export function calcUserCaptureExp(
  tier: PokemonTier,
  wildLevel: number,
  userLevel: number,
): number {
  const coef = USER_CAPTURE_EXP_BY_TIER[tier] ?? USER_CAPTURE_EXP_BY_TIER.common;
  const Lw = Math.max(1, Math.floor(wildLevel));
  const Lu = Math.max(USER_LEVEL_MIN, Math.floor(userLevel));
  const scale = Math.pow((2 * Lw + 10) / (Lw + Lu + 10), USER_CAPTURE_EXP_EXPONENT);
  return Math.floor(((coef * Lw) / 5) * scale + 1);
}

export function dailyCaptureMultiplier(nth: number): number {
  for (const step of USER_DAILY_CAPTURE_STEPS) {
    if (nth <= step.upTo) return step.mul;
  }
  return USER_DAILY_CAPTURE_STEPS[USER_DAILY_CAPTURE_STEPS.length - 1].mul;
}

export function applyDailyCaptureMultiplier(baseExp: number, nth: number): number {
  const mul = dailyCaptureMultiplier(nth);
  if (mul <= 0) return 0;
  return Math.max(1, Math.floor(baseExp * mul));
}

export function utcDateString(now: Date): string {
  return now.toISOString().slice(0, 10);
}

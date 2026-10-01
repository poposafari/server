import type { PokemonTier } from '../types';

export const USER_LEVEL_MIN = 1;
export const USER_LEVEL_MAX = 100;

export const USER_EXP_CURVE_A = 76;
export const USER_EXP_CURVE_P = 2;

export const USER_CAPTURE_EXP_BY_TIER: Record<PokemonTier, number> = {
  common: 10,
  uncommon: 12,
  rare: 15,
  'super-rare': 20,
  'ultra-rare': 30,
  epic: 40,
  unique: 60,
  legendary: 80,
};

export const USER_CAPTURE_EXP_EXPONENT = 1.5;

export const USER_DAILY_CAPTURE_STEPS: ReadonlyArray<{ upTo: number; mul: number }> = [
  { upTo: 50, mul: 1 },
  { upTo: 100, mul: 0.5 },
  { upTo: Infinity, mul: 0 },
];

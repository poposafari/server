export type TierKey =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'super-rare'
  | 'ultra-rare'
  | 'epic'
  | 'unique'
  | 'legendary';

export const LEVEL_CURVE = {
  // ── 포켓몬 레벨 ──
  POKEMON_LEVEL_MIN: 1,
  POKEMON_LEVEL_MAX: 100,

  // ── 포획 보너스 ──
  PARTY_LEVEL_COEF: 0.002,
  PARTY_LEVEL_CAP: 0.2,
  PARTY_SHINY_BONUS: 0.05,
  PARTY_TIER_BONUS: {
    common: 0,
    uncommon: 0.01,
    rare: 0.02,
    'super-rare': 0.03,
    'ultra-rare': 0.04,
    epic: 0.05,
    unique: 0.06,
    legendary: 0.07,
  } as Record<TierKey, number>,
  PARTY_SLOT_COUNT: 6,
  CAPTURE_RATE_CAP: 0.999,
  FLEE_RATE_CAP: 0.9,

  /** 파티 1마리의 레벨 보너스 (상한 적용). */
  partyLevelBonus: (level: number): number =>
    Math.min(LEVEL_CURVE.PARTY_LEVEL_CAP, level * LEVEL_CURVE.PARTY_LEVEL_COEF),

  // ── 캔디 보상 ──
  CANDY_BY_TIER: {
    common: 1,
    uncommon: 2,
    rare: 3,
    'super-rare': 4,
    'ultra-rare': 5,
    epic: 6,
    unique: 8,
    legendary: 10,
  } as Record<string, number>,

  // ── 판매 보상 ──
  SELL_CANDY_BY_TIER: {
    common: 1,
    uncommon: 1,
    rare: 2,
    'super-rare': 2,
    'ultra-rare': 3,
    epic: 3,
    unique: 4,
    legendary: 5,
  } as Record<TierKey, number>,
  SELL_EXP_CANDY_QTY_BY_TIER: {
    common: 1,
    uncommon: 1,
    rare: 2,
    'super-rare': 2,
    'ultra-rare': 3,
    epic: 3,
    unique: 4,
    legendary: 5,
  } as Record<TierKey, number>,
};

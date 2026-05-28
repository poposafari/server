export type TierKey = 'common' | 'rare' | 'epic' | 'legendary';

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
    rare: 0.01,
    epic: 0.02,
    legendary: 0.03,
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
    rare: 3,
    epic: 5,
    legendary: 10,
  } as Record<string, number>,

  // ── 판매 보상 ──
  SELL_CANDY_BY_TIER: {
    common: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
  } as Record<TierKey, number>,
  SELL_EXP_CANDY_QTY_BY_TIER: {
    common: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
  } as Record<TierKey, number>,
};

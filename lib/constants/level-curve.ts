export type TierKey = 'common' | 'rare' | 'epic' | 'legendary';

export const LEVEL_CURVE = {
  // ── 유저 레벨 ──
  USER_LEVEL_MAX: 100,

  /** 현재 레벨 → 다음 레벨까지 필요한 exp (이차곡선: L²). */
  expToNext: (level: number): number => level * level,

  // ── 포켓몬 레벨 ──
  POKEMON_LEVEL_MIN: 1,
  POKEMON_LEVEL_MAX: 100,

  // ── 야생 스폰 ──
  WILD_SPREAD: 3,

  /** 유저 레벨 기반 야생 포켓몬 레벨 범위 [min, max] (포함). pivot=userLevel ±WILD_SPREAD. */
  wildLevelRange: (userLevel: number): { min: number; max: number } => {
    const pivot = userLevel;
    const min = Math.max(LEVEL_CURVE.POKEMON_LEVEL_MIN, pivot - LEVEL_CURVE.WILD_SPREAD);
    const max = Math.min(LEVEL_CURVE.POKEMON_LEVEL_MAX, pivot + LEVEL_CURVE.WILD_SPREAD);
    return { min, max };
  },

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

  // ── 경험치 보상 ──
  EXP_BASE_BY_TIER: {
    common: 10,
    rare: 25,
    epic: 60,
    legendary: 150,
  } as Record<string, number>,

  /** 포획 성공 시 유저가 얻는 경험치. */
  expGain: (tier: string, wildLevel: number): number => {
    const base = LEVEL_CURVE.EXP_BASE_BY_TIER[tier] ?? 10;
    return Math.floor(base * (1 + wildLevel / 100));
  },

  // ── 캔디 보상 ──
  CANDY_BY_TIER: {
    common: 3,
    rare: 5,
    epic: 10,
    legendary: 20,
  } as Record<string, number>,
};

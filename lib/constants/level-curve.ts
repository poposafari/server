export type TierKey = 'common' | 'rare' | 'epic' | 'legendary' | 'mythical';

export const LEVEL_CURVE = {
  // ── 유저 레벨 ──
  USER_LEVEL_MAX: 50,

  /** 현재 레벨 → 다음 레벨까지 필요한 exp (현재 레벨 구간 내). */
  expToNext: (level: number): number => Math.floor(50 * level * level),

  // ── 포켓몬 레벨 ──
  POKEMON_LEVEL_MIN: 0,
  POKEMON_LEVEL_MAX: 999,

  // ── 야생 스폰 스케일 ──
  WILD_SCALE: 20,
  WILD_BASE_SPREAD: 5,
  WILD_SPREAD_GROWTH: 1.5,

  /** 유저 레벨 기반 야생 포켓몬 레벨 범위 [min, max] (포함). */
  wildLevelRange: (userLevel: number): { min: number; max: number } => {
    const pivot = Math.round(userLevel * LEVEL_CURVE.WILD_SCALE);
    const spread = Math.floor(
      LEVEL_CURVE.WILD_BASE_SPREAD + userLevel * LEVEL_CURVE.WILD_SPREAD_GROWTH,
    );
    const min = Math.max(LEVEL_CURVE.POKEMON_LEVEL_MIN, pivot - spread);
    const max = Math.min(LEVEL_CURVE.POKEMON_LEVEL_MAX, pivot + spread);
    return { min, max };
  },

  // ── 포획 보너스 ──
  PARTY_LEVEL_COEF: 0.0003,
  PARTY_LEVEL_CAP: 0.3,
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
    mythical: 200,
  } as Record<string, number>,

  /** 포획 성공 시 유저가 얻는 경험치. */
  expGain: (tier: string, wildLevel: number): number => {
    const base = LEVEL_CURVE.EXP_BASE_BY_TIER[tier] ?? 10;
    return Math.floor(base * (1 + wildLevel / 100));
  },
};

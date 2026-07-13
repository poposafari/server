import { PokemonTier } from '../types';

/** 낮은 등급 → 높은 등급 순. 업그레이드/비교의 기준 순서. */
export const TIER_ORDER: PokemonTier[] = [
  'common',
  'uncommon',
  'rare',
  'super-rare',
  'ultra-rare',
  'epic',
  'unique',
  'legendary',
];

export const MAX_UPGRADE_TIER: PokemonTier = 'unique';

export const tierRank = (tier: PokemonTier): number => TIER_ORDER.indexOf(tier);

export const nextTier = (tier: PokemonTier): PokemonTier | null => {
  const idx = TIER_ORDER.indexOf(tier);
  if (idx === -1 || idx >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
};

export const resolveTier = (
  stored: string | null | undefined,
  masterTier: PokemonTier,
): PokemonTier => (stored ? (stored as PokemonTier) : masterTier);

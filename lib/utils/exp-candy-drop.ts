import { LEVEL_CURVE } from '../constants/level-curve';
import type { PokemonTier } from '../types';

export interface ExpCandyDrop {
  itemId: string;
  quantity: number;
}

export function pickExpCandyDrop(tier: PokemonTier, wildLevel: number): ExpCandyDrop {
  switch (tier) {
    case 'common':
      return wildLevel <= 30
        ? { itemId: 'experience-candy-xs', quantity: 1 }
        : { itemId: 'experience-candy-s', quantity: 1 };
    case 'rare':
      return wildLevel <= 30
        ? { itemId: 'experience-candy-s', quantity: 1 }
        : { itemId: 'experience-candy-m', quantity: 1 };
    case 'epic':
      return wildLevel <= 50
        ? { itemId: 'experience-candy-m', quantity: 1 }
        : { itemId: 'experience-candy-l', quantity: 1 };
    case 'legendary':
      return wildLevel <= 50
        ? { itemId: 'experience-candy-l', quantity: 1 }
        : { itemId: 'experience-candy-xl', quantity: 1 };
  }
}

export function pickSellExpCandy(tier: PokemonTier, level: number): ExpCandyDrop {
  return {
    itemId: pickExpCandyDrop(tier, level).itemId,
    quantity: LEVEL_CURVE.SELL_EXP_CANDY_QTY_BY_TIER[tier],
  };
}

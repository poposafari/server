export type ItemCategory = 'pokeball' | 'berry' | 'key' | 'tms_hms' | 'etc';
export type ItemTier = 'common' | 'rare' | 'epic' | 'legendary';

export interface ItemData {
  id: string;
  buy: number;
  category: ItemCategory;
  comment: string;
  purchasable: boolean;
  sell: number;
  sellable: boolean;
  spawnMax: number;
  spawnRate: number;
  spawnable: boolean;
  tier: ItemTier;
}

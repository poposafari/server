import { CatchItem, EnterOrExit, Item, Overworld, Pokemon, Rarity, RewardCandy, RewardItem, SpawnableItem } from './utils/type';

export const ItemData: Record<string, Item> = {};
export const SpawnableItemTable: SpawnableItem[] = [];

export const OverworldData: Record<string, Overworld> = {};
export const EnterData: Record<string, EnterOrExit> = {};
export const ExitData: Record<string, EnterOrExit> = {};
export const PokemonData: Record<string, Pokemon> = {};

export const CatchData: Record<string, CatchItem> = {};

export const RewardData: Partial<Record<Rarity, RewardItem[]>> = {};
export const RewardCandyData: Partial<Record<Rarity, RewardCandy>> = {};

export const getItemData = (item: string) => {
  const found = ItemData[item];

  if (!found) throw Error('Not found item data');

  return found;
};

export const getOverworldData = (key: string) => {
  const found = OverworldData[key];

  if (!found) throw Error('Not found overworld data');

  return found;
};

export const getEnterData = (key: string) => {
  const found = EnterData[key];

  if (!found) throw Error('Not found exit data');

  return found;
};

export const getExitData = (key: string) => {
  const found = ExitData[key];

  if (!found) throw Error('Not found enter data');

  return found;
};

export const getPokemonData = (pokedex: string) => {
  const found = PokemonData[pokedex];

  if (!found) throw Error('Not found item data');

  return found;
};

export const getCatchItemData = (item: string) => {
  const found = CatchData[item];

  if (!found) throw Error('Not found item data');

  return found;
};

export const getRewardData = (rarity: Rarity) => {
  const found = RewardData[rarity];

  if (!found) throw Error('Not found item data');

  return found;
};

export const getRewardCandyData = (rarity: Rarity) => {
  const found = RewardCandyData[rarity];

  if (!found) throw Error('Not found item data');

  return found;
};

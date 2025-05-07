import { Item, Overworld, Pokemon, SpawnableItem } from "./utils/type";

export const ItemData: Record<string, Item> = {};
export const SpawnableItemTable: SpawnableItem[] = [];

export const OverworldData: Record<string, Overworld> = {};
export const PokemonData: Record<string, Pokemon> = {};

export const getItemData = (item: string) => {
  const found = ItemData[item];

  if (!found) throw Error("Not found item data");

  return found;
};

export const getOverworldData = (key: string) => {
  const found = OverworldData[key];

  if (!found) throw Error("Not found overworld data");

  return found;
};

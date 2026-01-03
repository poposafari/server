export type ItemCategory = "pokeball" | "berry" | "key" | "tms_hms" | "etc";
export type ItemTier = "common" | "rare" | "epic" | "legendary";

export interface ItemSpawn {
  spawnable: boolean;
  rate: number;
}

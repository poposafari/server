export type PokemonTier = "common" | "rare" | "epic" | "legendary" | "mythical";
export type PokemonSpawnTile = "land" | "water";

export interface PokemonSpawnRate {
  spawn: number;
  capture: number;
  flee: number;
  male: number;
  female: number;
}

export interface PokemonEvolution {
  next: string[];
  cost: string[];
}

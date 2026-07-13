export interface PokemonBoxRes {
  success: true;
  data: {
    id: number;
    pokedexId: number;
    level: number;
    friendship: number;
    gender: number;
    isShiny: boolean;
    nickname: string | null;
    tier: string | null;
    abilityId: string;
    natureId: string;
    skills: unknown;
    heldItemId: string | null;
    boxNumber: number | null;
    gridNumber: number | null;
    ballId: number;
    caughtLocation: string;
    caughtAt: Date;
  }[];
}

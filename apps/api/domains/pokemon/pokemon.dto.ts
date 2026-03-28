export interface PokemonBoxRes {
  success: true;
  data: {
    id: number;
    pokedexId: number;
    level: number;
    gender: number;
    isShiny: boolean;
    nickname: string | null;
    abilityId: number;
    natureId: number;
    skills: unknown;
    heldItemId: number | null;
    boxNumber: number | null;
    gridNumber: number | null;
    ballId: number;
    caughtLocation: string;
    caughtAt: Date;
  }[];
}

export interface PokedexRes {
  success: true;
  data: {
    pokedexId: number;
    caughtCount: number;
    registeredAt: Date;
  }[];
}

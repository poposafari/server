export interface FossilRecipe {
  ingredients: string[];
  pokedexId: string;
}

export const FOSSIL_RECIPES: Record<number, FossilRecipe> = {
  1: { ingredients: ['helix-fossil'], pokedexId: '0138' },
  2: { ingredients: ['dome-fossil'], pokedexId: '0140' },
  3: { ingredients: ['old-amber'], pokedexId: '0142' },
  4: { ingredients: ['root-fossil'], pokedexId: '0345' },
  5: { ingredients: ['claw-fossil'], pokedexId: '0347' },
  6: { ingredients: ['skull-fossil'], pokedexId: '0408' },
  7: { ingredients: ['armor-fossil'], pokedexId: '0410' },
  8: { ingredients: ['cover-fossil'], pokedexId: '0564' },
  9: { ingredients: ['plume-fossil'], pokedexId: '0566' },
  10: { ingredients: ['jaw-fossil'], pokedexId: '0696' },
  11: { ingredients: ['sail-fossil'], pokedexId: '0698' },
  12: { ingredients: ['fossilized-bird', 'fossilized-drake'], pokedexId: '0880' },
  13: { ingredients: ['fossilized-bird', 'fossilized-dino'], pokedexId: '0881' },
  14: { ingredients: ['fossilized-fish', 'fossilized-drake'], pokedexId: '0882' },
  15: { ingredients: ['fossilized-fish', 'fossilized-dino'], pokedexId: '0883' },
};

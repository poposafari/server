import { userPokemon } from '@poposerver/lib/schema';

export interface RestoreFossilRes {
  success: true;
  data: {
    pokemon: typeof userPokemon.$inferSelect;
  };
}

import { PokemonRepository } from './pokemon.repository';

export class PokemonService {
  constructor(private readonly repo: PokemonRepository) {}

  async getBox(authId: string) {
    return this.repo.findBoxByAccountId(Number(authId));
  }
}

import { PokedexRepository } from './pokedex.repository';

export class PokedexService {
  constructor(private readonly repo: PokedexRepository) {}

  async getAll(authId: string) {
    return this.repo.findAllByAccountId(Number(authId));
  }
}

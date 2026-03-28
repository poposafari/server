import { TownMapRepository } from './town-map.repository';

export class TownMapService {
  constructor(private readonly repo: TownMapRepository) {}

  async getAll(authId: string) {
    return this.repo.findAllByAccountId(Number(authId));
  }
}

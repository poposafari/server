import { ItemRepository } from './item.repository';

export class ItemService {
  constructor(private readonly repo: ItemRepository) {}

  async getBag(authId: string) {
    return this.repo.findBagByAccountId(Number(authId));
  }
}

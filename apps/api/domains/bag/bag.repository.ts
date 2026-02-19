import { UserBag } from '@poposerver/shared';
import { EntityManager, Repository } from 'typeorm';

const ITEM_QUANTITY_MAX = 999;

export class BagRepository {
  constructor(private readonly bagRepository: Repository<UserBag>) {}

  private repo(manager?: EntityManager): Repository<UserBag> {
    return manager ? manager.getRepository(UserBag) : this.bagRepository;
  }

  async findAllByAuthId(authId: string): Promise<UserBag[]> {
    return this.bagRepository.find({
      where: { authId },
      select: ['id', 'itemId', 'quantity'],
    });
  }

  async findOneByAuthIdAndItemId(
    authId: string,
    itemId: string,
    manager?: EntityManager,
  ): Promise<UserBag | null> {
    return this.repo(manager).findOne({
      where: { authId, itemId },
      lock: manager ? { mode: 'pessimistic_write' } : undefined,
    });
  }

  async save(entity: UserBag, manager?: EntityManager): Promise<UserBag> {
    return this.repo(manager).save(entity);
  }

  static getItemQuantityMax(): number {
    return ITEM_QUANTITY_MAX;
  }
}

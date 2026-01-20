import { UserBag } from '@poposerver/shared';
import { Repository } from 'typeorm';

export class BagRepository {
  constructor(private readonly bagRepository: Repository<UserBag>) {}

  async findAllByAuthId(authId: string): Promise<UserBag[]> {
    return this.bagRepository.find({
      where: { authId },
      select: ['id', 'itemId', 'quantity'],
    });
  }
}

import { UserCostume } from '@poposerver/shared';
import { EntityManager, Repository } from 'typeorm';

export class CostumeRepository {
  constructor(private readonly costumeRepository: Repository<UserCostume>) {}

  async findAllByAuthId(authId: string): Promise<UserCostume[]> {
    return this.costumeRepository.find({
      where: { authId },
      select: ['id', 'costumeId'],
    });
  }

  async create(authId: string, costumeId: string, manager?: EntityManager): Promise<UserCostume> {
    const costume = this.costumeRepository.create({ authId, costumeId });
    if (manager) {
      return manager.save(UserCostume, costume);
    }
    return this.costumeRepository.save(costume);
  }
}

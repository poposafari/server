import { User, UserLocationData } from '@poposerver/shared';
import { EntityManager, Repository } from 'typeorm';
import { CreateUserReq } from './user.dto';

export class UserRepository {
  constructor(private readonly userRepository: Repository<User>) {}

  async findByNickname(nickname: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { nickname } });
  }

  async findByAuthId(authId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { authId },
      select: [
        'nickname',
        'money',
        'candy',
        'playTime',
        'isNewbie',
        'gender',
        'lastCostume',
        'lastLocation',
        'lastParty',
        'lastQuickslot',
        'lastTownmap',
        'pcSettings',
        'createdAt',
      ],
    });
  }

  async create(
    authId: string,
    data: CreateUserReq,
    location: UserLocationData,
    entityManager?: EntityManager,
  ): Promise<User> {
    const { costume, nickname, gender } = data;
    const user = this.userRepository.create({
      authId,
      lastCostume: costume,
      nickname,
      gender,
      lastLocation: location,
    });

    if (entityManager) {
      return entityManager.save(User, user);
    }
    return this.userRepository.save(user);
  }
}

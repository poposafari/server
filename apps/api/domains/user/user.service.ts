import { DataSource } from 'typeorm';
import { UserRepository } from './user.repository';
import { CreateUserReq, GetUserRes } from './user.dto';
import {
  AppError,
  AppErrorCode,
  AppErrorMessage,
  UserAvatarParts,
  UserBag,
  UserCostume,
  UserPokemon,
  UserStartLocation,
} from '@poposerver/shared';
import { BagRepository } from '../bag/bag.repository';
import { CostumeRepository } from '../costume/costume.repository';
import { PcRepository } from '../pc/pc.repository';

export class UserService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly userRepository: UserRepository,
    private readonly bagRepository: BagRepository,
    private readonly costumeRepository: CostumeRepository,
    private readonly pcRepository: PcRepository,
  ) {}

  async createUser(authId: string, req: CreateUserReq): Promise<GetUserRes> {
    const { costume, nickname } = req;
    let retCostume = [];

    const existingNickname = await this.userRepository.findByNickname(nickname);
    if (existingNickname) {
      throw new AppError(
        AppErrorMessage.USER_ALREADY_EXISTS,
        409,
        AppErrorCode.USER_ALREADY_EXISTS,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await this.userRepository.create(
        authId,
        req,
        UserStartLocation,
        queryRunner.manager,
      );

      for (const part of UserAvatarParts) {
        const costumeId = costume[part];
        const newCostume = await this.costumeRepository.create(
          authId,
          costumeId,
          queryRunner.manager,
        );
        retCostume.push(newCostume.costumeId);
      }

      await queryRunner.commitTransaction();

      return {
        profile: user,
        pc: [],
        bag: {},
        costume: retCostume,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getUser(authId: string): Promise<GetUserRes> {
    const user = await this.userRepository.findByAuthId(authId);

    if (!user) {
      throw new AppError(AppErrorMessage.USER_NOT_FOUND, 404, AppErrorCode.USER_NOT_FOUND);
    }

    const [allBags, allCostumes, allPokemons] = await Promise.all([
      this.bagRepository.findAllByAuthId(authId),
      this.costumeRepository.findAllByAuthId(authId),
      this.pcRepository.findAllByAuthId(authId),
    ]);

    const bagData: Record<string, { id: string; quantity: number }> = {};
    allBags.forEach((bag: UserBag) => {
      bagData[bag.itemId] = {
        id: bag.id,
        quantity: bag.quantity,
      };
    });

    const costumeData: string[] = [];
    allCostumes.forEach((costume: UserCostume) => {
      costumeData.push(costume.costumeId);
    });

    const pcStorage: Record<number, UserPokemon[]> = {};
    allPokemons.forEach((pokemon: UserPokemon) => {
      if (!pcStorage[pokemon.box]) {
        pcStorage[pokemon.box] = [];
      }
      pcStorage[pokemon.box].push(pokemon);
    });

    return {
      profile: user,
      pc: pcStorage,
      bag: bagData,
      costume: costumeData,
    };
  }

  async catchStartingPokemon(authId: string) {}
}

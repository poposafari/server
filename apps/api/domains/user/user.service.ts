import { AppError } from '@poposerver/lib/utils/error';
import { AppErrorCode, AppErrorMessage, PokemonGender, UserStartLocation } from '@poposerver/lib/types';
import { setUserState } from '@poposerver/lib/redis';
import { UserRepository } from './user.repository';
import { CreateUserInput } from './user.schema';

export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  async createUser(authId: string, dto: CreateUserInput) {
    const accountId = Number(authId);

    const existing = await this.userRepo.findByAccountId(accountId);
    if (existing) {
      throw new AppError(
        AppErrorMessage.USER_ALREADY_EXISTS,
        409,
        AppErrorCode.USER_ALREADY_EXISTS,
      );
    }

    const nicknameExists = await this.userRepo.findByNickname(dto.nickname);
    if (nicknameExists) {
      throw new AppError(
        AppErrorMessage.NICKNAME_ALREADY_EXISTS,
        409,
        AppErrorCode.NICKNAME_ALREADY_EXISTS,
      );
    }

    const genderNum = dto.gender === 'male' ? PokemonGender.MALE : PokemonGender.FEMALE;
    const genderPrefix = dto.gender === 'male' ? 'm' : 'f';

    const costumeIds = [
      dto.costume.skin,
      `${genderPrefix}_${dto.costume.hair}`,
      `${genderPrefix}_${dto.costume.outfit}`,
    ];

    const { map: lastMapId, x, y } = UserStartLocation;

    try {
      await this.userRepo.createWithCostumes(
        accountId,
        dto.nickname,
        genderNum,
        lastMapId,
        x,
        y,
        costumeIds,
      );
    } catch (error: any) {
      if (error.code === '23505') {
        if (error.constraint?.includes('nickname')) {
          throw new AppError(
            AppErrorMessage.NICKNAME_ALREADY_EXISTS,
            409,
            AppErrorCode.NICKNAME_ALREADY_EXISTS,
          );
        }
        throw new AppError(
          AppErrorMessage.USER_ALREADY_EXISTS,
          409,
          AppErrorCode.USER_ALREADY_EXISTS,
        );
      }
      throw error;
    }
  }

  async getMyGameData(authId: string) {
    const accountId = Number(authId);
    const result = await this.userRepo.findGameDataByAccountId(accountId);

    if (!result) {
      throw new AppError(
        AppErrorMessage.USER_NOT_FOUND,
        404,
        AppErrorCode.USER_NOT_FOUND,
      );
    }

    const { profile, equippedCostumes, party, itemSlots } = result;

    await setUserState(
      authId,
      {
        mapId: profile.lastMapId,
        x: String(profile.lastX),
        y: String(profile.lastY),
        nickname: profile.nickname,
        gender: String(profile.gender),
        party: JSON.stringify(party),
        itemSlots: JSON.stringify(itemSlots),
        costume: JSON.stringify(equippedCostumes),
        socketId: '',
        pet: '',
        createdAt: new Date().toISOString(),
        lastMoveTime: String(Date.now()),
      },
    );

    return { profile, equippedCostumes, party, itemSlots };
  }
}

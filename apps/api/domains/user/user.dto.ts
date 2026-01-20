import { User, UserAvatarData, UserGender, UserPokemon } from '@poposerver/shared';

export interface CreateUserReq {
  costume: UserAvatarData;
  nickname: string;
  gender: UserGender;
}

export interface GetUserRes {
  profile: User;
  pc: Record<number, UserPokemon[]>;
  bag: Record<string, { id: string; quantity: number }>;
  costume: string[];
}

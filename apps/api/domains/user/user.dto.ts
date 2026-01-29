import { User, UserCostumeData, UserGender, UserPokemon } from '@poposerver/shared';

export interface CreateUserReq {
  nickname: string;
  gender: UserGender;
  costume: UserCostumeData;
}

export interface GetUserRes {
  profile: User;
  pc: Record<number, UserPokemon[]>;
  bag: Record<string, { id: string; quantity: number }>;
  costume: string[];
}

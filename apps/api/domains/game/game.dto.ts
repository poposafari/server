import { PokemonGender, PokemonRegion, UserPokemon } from '@poposerver/shared';

/** 스타팅 30마리 중 한 마리 (클라이언트 표시용, DB 미저장) */
export interface StartingPokemonItemDto {
  index: number;
  pokemonId: string;
  region: PokemonRegion;
  form: string | null;
  gender: PokemonGender;
  shiny: boolean;
  comment: string;
}

/** GET 스타팅 목록 응답 */
export interface GetStartingListRes {
  list: StartingPokemonItemDto[];
}

/** POST 스타팅 선택 요청 (0 ~ 29) */
export interface SelectStartingDto {
  index: number;
}

/** POST 스타팅 선택 응답 (authId 제외) */
export type CatchStartingPokemonRes = Omit<UserPokemon, 'authId' | 'auth'>;

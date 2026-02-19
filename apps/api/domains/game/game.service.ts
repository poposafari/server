import {
  AppError,
  AppErrorCode,
  AppErrorMessage,
  MasterData,
  PokemonGender,
  PokemonRegion,
  createStartingRng,
  rollGenderSeeded,
  rollShinySeeded,
  type SeededRng,
} from '@poposerver/shared';
import {
  LUCKY_STARTING_MAX,
  LUCKY_STARTING_MIN,
  STARTING_ITEMS,
  STARTING_POKEMONS,
  STARTING_TOTAL,
} from './game.constant';
import type { StartingPokemonItemDto } from './game.dto';
import { DataSource } from 'typeorm';
import type { AddUserPokemonParams, PcService } from '../pc/pc.service';
import type { BagService } from '../bag/bag.service';
import type { UserRepository } from '../user/user.repository';

function pickLuckyPokemonId(rng: SeededRng): string {
  const num =
    LUCKY_STARTING_MIN + Math.floor(rng() * (LUCKY_STARTING_MAX - LUCKY_STARTING_MIN + 1));
  return String(num).padStart(4, '0');
}

function buildOneStartingSlot(slotIndex: number, rng: SeededRng): StartingPokemonItemDto {
  const pokemonId =
    slotIndex < STARTING_POKEMONS.length ? STARTING_POKEMONS[slotIndex] : pickLuckyPokemonId(rng);

  const data = MasterData.getPokemon(pokemonId);
  const rateMale = data?.rateMale ?? 0.5;
  const rateFemale = data?.rateFemale ?? 0.5;
  const comment = data?.comment ?? '';

  const shiny = rollShinySeeded(rng);
  const gender = rollGenderSeeded(rng, rateMale, rateFemale);

  return {
    index: slotIndex,
    pokemonId,
    region: PokemonRegion.NONE,
    form: null,
    gender,
    shiny,
    comment,
  };
}

export class GameService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly pcService: PcService,
    private readonly bagService: BagService,
    private readonly userRepository: UserRepository,
  ) {}

  private async ensureNewbie(authId: string): Promise<void> {
    const user = await this.userRepository.findByAuthId(authId);
    if (!user || !user.isNewbie) {
      throw new AppError(AppErrorMessage.NOT_NEWBIE, 403, AppErrorCode.NOT_NEWBIE);
    }
  }

  /**
   * 스타팅 포켓몬 30마리를 시드(authId) 기반으로 생성해 반환.
   * isNewbie가 true인 유저만 호출 가능. DB에 저장하지 않음.
   */
  async getStartingList(authId: string): Promise<StartingPokemonItemDto[]> {
    await this.ensureNewbie(authId);

    const rng = createStartingRng(authId);
    const list: StartingPokemonItemDto[] = [];

    for (let i = 0; i < STARTING_TOTAL; i++) {
      list.push(buildOneStartingSlot(i, rng));
    }

    return list;
  }

  /**
   * 스타팅 30마리 중 선택한 한 마리만 재계산해 반환.
   * 요청 시 이 1마리만 DB에 저장하면 된다.
   */
  getSelectedStartingPokemon(authId: string, selectedIndex: number): StartingPokemonItemDto {
    const rng = createStartingRng(authId);

    for (let i = 0; i < selectedIndex; i++) {
      buildOneStartingSlot(i, rng);
    }

    return buildOneStartingSlot(selectedIndex, rng);
  }

  /**
   * 선택한 스타팅 1마리를 PC에 추가하고, STARTING_ITEMS를 가방에 지급한 뒤 isNewbie를 false로 변경한다.
   * PC 추가·가방 지급·isNewbie 갱신은 한 트랜잭션으로 묶이며, isNewbie가 true인 유저만 호출 가능.
   */
  async catchStartingPokemon(authId: string, index: number) {
    await this.ensureNewbie(authId);

    const selected = this.getSelectedStartingPokemon(authId, index);

    const params: AddUserPokemonParams = {
      authId,
      pokedex: selected.pokemonId,
      region: selected.region,
      form: selected.form ?? '',
      held: '',
      gender: selected.gender,
      shiny: selected.shiny,
      addType: 'catch',
    };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const pokemon = await this.pcService.addUserPokemon(params, queryRunner.manager);

      for (const { item, quantity } of STARTING_ITEMS) {
        await this.bagService.addItem(authId, item, quantity, queryRunner.manager);
      }

      await this.userRepository.updateIsNewbie(authId, false, queryRunner.manager);

      await queryRunner.commitTransaction();
      return pokemon;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

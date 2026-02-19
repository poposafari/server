import {
  AppError,
  AppErrorCode,
  AppErrorMessage,
  PokemonGender,
  PokemonRegion,
  UserPokemon,
} from '@poposerver/shared';
import { DataSource, EntityManager } from 'typeorm';
import { BOX_MAX, BOX_SLOT_MAX } from './constants';
import { PcRepository } from './pc.repository';

export type AddUserPokemonType = 'catch' | 'evolve';

export interface AddUserPokemonParams {
  authId: string;
  pokedex: string;
  region: PokemonRegion;
  form: string;
  held: string;
  gender: PokemonGender;
  shiny: boolean;
  addType: AddUserPokemonType;
}

export class PcService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly pcRepository: PcRepository,
  ) {}

  async addUserPokemon(
    params: AddUserPokemonParams,
    manager?: EntityManager,
  ): Promise<UserPokemon> {
    const { authId, pokedex, region, form, held, gender, shiny, addType } = params;

    const run = async (em: EntityManager): Promise<UserPokemon> => {
      const existing = await this.pcRepository.findOneByPokemonIdAndRegionAndGender(
        authId,
        pokedex,
        region,
        gender,
        em,
      );

      if (existing) {
        existing.catchCount += addType === 'catch' ? 1 : 10;
        return this.pcRepository.save(existing, em);
      }

      const used = await this.pcRepository.findBoxAndSlotByAuthId(authId, em);
      const usedByBox = new Map<number, Set<number>>();
      for (const { box, slot } of used) {
        if (!usedByBox.has(box)) usedByBox.set(box, new Set());
        usedByBox.get(box)!.add(slot);
      }

      let targetBox = 0;
      let targetSlot = -1;
      for (let box = 1; box <= BOX_MAX; box++) {
        const slots = usedByBox.get(box) ?? new Set<number>();
        if (slots.size >= BOX_SLOT_MAX) continue;
        for (let slot = 0; slot < BOX_SLOT_MAX; slot++) {
          if (!slots.has(slot)) {
            targetBox = box;
            targetSlot = slot;
            break;
          }
        }
        if (targetSlot >= 0) break;
      }

      if (targetSlot < 0) {
        throw new AppError(AppErrorMessage.PC_BOX_FULL, 400, AppErrorCode.PC_BOX_FULL);
      }

      const catchCount = addType === 'catch' ? 1 : 10;
      const entity = Object.assign(new UserPokemon(), {
        authId,
        pokemonId: pokedex,
        box: targetBox,
        slot: targetSlot,
        region,
        form: form || null,
        held: held || null,
        gender,
        shiny,
        catchCount,
      });

      return this.pcRepository.save(entity, em);
    };

    if (manager) {
      return run(manager);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const saved = await run(queryRunner.manager);
      await queryRunner.commitTransaction();
      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

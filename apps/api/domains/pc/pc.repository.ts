import { UserPokemon } from '@poposerver/shared';
import { EntityManager, Repository } from 'typeorm';
import { PokemonGender, PokemonRegion } from '@poposerver/shared';

export class PcRepository {
  constructor(private readonly pcRepository: Repository<UserPokemon>) {}

  private repo(manager?: EntityManager): Repository<UserPokemon> {
    return manager ? manager.getRepository(UserPokemon) : this.pcRepository;
  }

  async findAllByAuthId(authId: string): Promise<UserPokemon[]> {
    return this.pcRepository.find({
      where: { authId },
      select: ['id', 'pokemonId', 'box', 'slot', 'gender', 'catchCount', 'friendShip', 'shiny'],
    });
  }

  async findOneByPokemonIdAndRegionAndGender(
    authId: string,
    pokemonId: string,
    region: PokemonRegion,
    gender: PokemonGender,
    manager?: EntityManager,
  ): Promise<UserPokemon | null> {
    return this.repo(manager).findOne({
      where: { authId, pokemonId, region, gender },
    });
  }

  async findBoxAndSlotByAuthId(
    authId: string,
    manager?: EntityManager,
  ): Promise<{ box: number; slot: number }[]> {
    const rows = await this.repo(manager).find({
      where: { authId },
      select: ['box', 'slot'],
    });
    return rows.map((r) => ({ box: r.box, slot: r.slot }));
  }

  async save(entity: UserPokemon, manager?: EntityManager): Promise<UserPokemon> {
    return this.repo(manager).save(entity);
  }
}

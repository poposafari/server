import { UserPokemon } from '@poposerver/shared';
import { Repository } from 'typeorm';

export class PcRepository {
  constructor(private readonly pcRepository: Repository<UserPokemon>) {}

  async findAllByAuthId(authId: string): Promise<UserPokemon[]> {
    return this.pcRepository.find({
      where: { authId },
      select: ['id', 'pokemonId', 'box', 'gender', 'catchCount', 'friendShip', 'shiny'],
    });
  }
}

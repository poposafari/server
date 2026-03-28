import { db } from '@poposerver/lib/db';
import { userPokemon } from '@poposerver/lib/schema';
import { eq, and, isNull } from 'drizzle-orm';

export class PokemonRepository {
  async findBoxByAccountId(accountId: number) {
    return db
      .select({
        id: userPokemon.id,
        pokedexId: userPokemon.pokedexId,
        level: userPokemon.level,
        gender: userPokemon.gender,
        isShiny: userPokemon.isShiny,
        nickname: userPokemon.nickname,
        abilityId: userPokemon.abilityId,
        natureId: userPokemon.natureId,
        skills: userPokemon.skills,
        heldItemId: userPokemon.heldItemId,
        boxNumber: userPokemon.boxNumber,
        gridNumber: userPokemon.gridNumber,
        ballId: userPokemon.ballId,
        caughtLocation: userPokemon.caughtLocation,
        caughtAt: userPokemon.caughtAt,
      })
      .from(userPokemon)
      .where(
        and(eq(userPokemon.accountId, accountId), isNull(userPokemon.partySlot)),
      )
      .orderBy(userPokemon.boxNumber, userPokemon.gridNumber);
  }
}

import { db } from '@poposerver/lib/db';
import { userPokemon, userBoxMeta } from '@poposerver/lib/schema';
import { eq, and, isNull, inArray, isNotNull, notInArray, sql } from 'drizzle-orm';

export class PokemonRepository {
  async findByIdAndAccount(id: number, accountId: number) {
    const [row] = await db
      .select()
      .from(userPokemon)
      .where(and(eq(userPokemon.id, id), eq(userPokemon.accountId, accountId)));
    return row ?? null;
  }

  async findBoxByAccountId(accountId: number) {
    return db
      .select({
        id: userPokemon.id,
        pokedexId: userPokemon.pokedexId,
        level: userPokemon.level,
        exp: userPokemon.exp,
        friendship: userPokemon.friendship,
        gender: userPokemon.gender,
        isShiny: userPokemon.isShiny,
        nickname: userPokemon.nickname,
        tier: userPokemon.tier,
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
      .where(and(eq(userPokemon.accountId, accountId), isNull(userPokemon.partySlot)))
      .orderBy(userPokemon.boxNumber, userPokemon.gridNumber);
  }

  async findByIdsAndAccount(ids: number[], accountId: number) {
    return db
      .select({ id: userPokemon.id })
      .from(userPokemon)
      .where(and(inArray(userPokemon.id, ids), eq(userPokemon.accountId, accountId)));
  }

  async findRowsByIdsAndAccount(ids: number[], accountId: number) {
    return db
      .select({
        id: userPokemon.id,
        pokedexId: userPokemon.pokedexId,
        level: userPokemon.level,
        partySlot: userPokemon.partySlot,
      })
      .from(userPokemon)
      .where(and(inArray(userPokemon.id, ids), eq(userPokemon.accountId, accountId)));
  }

  async findBoxMetaByAccountId(accountId: number) {
    return db
      .select({
        boxNumber: userBoxMeta.boxNumber,
        wallpaper: userBoxMeta.wallpaper,
        name: userBoxMeta.name,
      })
      .from(userBoxMeta)
      .where(eq(userBoxMeta.accountId, accountId))
      .orderBy(userBoxMeta.boxNumber);
  }

  async upsertBoxMeta(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    accountId: number,
    meta: { boxNumber: number; wallpaper: number; name: string },
  ) {
    await tx
      .insert(userBoxMeta)
      .values({
        accountId,
        boxNumber: meta.boxNumber,
        wallpaper: meta.wallpaper,
        name: meta.name,
      })
      .onConflictDoUpdate({
        target: [userBoxMeta.accountId, userBoxMeta.boxNumber],
        set: { wallpaper: meta.wallpaper, name: meta.name },
      });
  }

  async countPartyExcluding(accountId: number, excludeIds: number[]) {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userPokemon)
      .where(
        and(
          eq(userPokemon.accountId, accountId),
          isNotNull(userPokemon.partySlot),
          notInArray(userPokemon.id, excludeIds),
        ),
      );
    return Number(row?.count ?? 0);
  }
}

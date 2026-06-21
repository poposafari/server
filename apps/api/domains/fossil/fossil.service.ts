import { sql, eq, and, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@poposerver/lib/db';
import { userItem, userPokemon, userPokedex } from '@poposerver/lib/schema';
import { MasterData } from '@poposerver/lib/utils/master-data';
import { AppError } from '@poposerver/lib/utils/error';
import { auditTx } from '@poposerver/lib/utils/audit';
import { AppErrorCode, AuditAction, PokemonNatural } from '@poposerver/lib/types';
import { rollGender, rollSafariShiny, pickOne } from '@poposerver/lib/utils/rng';
import { getUserState } from '@poposerver/lib/redis';
import { totalExpForLevel } from '@poposerver/lib/utils/exp-curve';
import { LEVEL_CURVE } from '@poposerver/lib/constants/level-curve';
import { PC_STORAGE } from '@poposerver/lib/constants/pc';
import { FOSSIL_RECIPES } from './fossil.recipe';

const FOSSIL_LEVEL = 20;

export class FossilService {
  async restore(
    authId: string,
    id: number,
    ip?: string,
  ): Promise<{ pokemon: typeof userPokemon.$inferSelect }> {
    const accountId = Number(authId);

    const recipe = FOSSIL_RECIPES[id];
    if (!recipe) {
      throw new AppError(
        `Fossil recipe ${id} not found`,
        404,
        AppErrorCode.FOSSIL_RECIPE_NOT_FOUND,
      );
    }

    const pokemonData = MasterData.getPokemon(recipe.pokedexId);
    if (!pokemonData) {
      throw new AppError(
        `Pokemon data ${recipe.pokedexId} not found`,
        500,
        AppErrorCode.INTERNAL_SERVER_ERROR,
      );
    }

    // 재료 보유 확인
    const ownedRows = await db
      .select({ itemId: userItem.itemId, quantity: userItem.quantity })
      .from(userItem)
      .where(and(eq(userItem.accountId, accountId), inArray(userItem.itemId, recipe.ingredients)));
    const ownedMap = new Map(ownedRows.map((r) => [r.itemId, r.quantity]));

    const missing = recipe.ingredients.filter((it) => (ownedMap.get(it) ?? 0) < 1);
    if (missing.length > 0) {
      throw new AppError(
        `Missing fossil ingredient(s): ${missing.join(', ')}`,
        400,
        AppErrorCode.FOSSIL_INGREDIENT_INSUFFICIENT,
      );
    }

    // caughtLocation = 현재 사용자의 맵
    const userState = await getUserState(authId);
    const caughtLocation = userState?.mapId ?? 'p001';

    // 화석 복원 포켓몬은 고정 L20
    const level = FOSSIL_LEVEL;
    const gender = rollGender(pokemonData.rateMale, pokemonData.rateFemale);
    const nature = pickOne(PokemonNatural);
    const ability = pokemonData.ability.length ? pickOne(pokemonData.ability) : '';
    const isShiny = rollSafariShiny();

    const insertedPokemon = await db.transaction(async (tx) => {
      // 재료 1개씩 소비
      for (const itemId of recipe.ingredients) {
        const owned = ownedMap.get(itemId)!;
        if (owned === 1) {
          await tx
            .delete(userItem)
            .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, itemId)));
        } else {
          await tx
            .update(userItem)
            .set({ quantity: sql`${userItem.quantity} - 1` })
            .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, itemId)));
        }
      }

      const existingPartySlots = await tx
        .select({ partySlot: userPokemon.partySlot })
        .from(userPokemon)
        .where(and(eq(userPokemon.accountId, accountId), isNotNull(userPokemon.partySlot)));

      const occupiedPartySlots = new Set(existingPartySlots.map((p) => p.partySlot));

      let targetPartySlot: number | null = null;
      for (let s = 0; s < LEVEL_CURVE.PARTY_SLOT_COUNT; s++) {
        if (!occupiedPartySlots.has(s)) {
          targetPartySlot = s;
          break;
        }
      }

      let targetBox: number | null = null;
      let targetGrid: number | null = null;

      if (targetPartySlot === null) {
        const existingBoxPokemon = await tx
          .select({ boxNumber: userPokemon.boxNumber, gridNumber: userPokemon.gridNumber })
          .from(userPokemon)
          .where(and(eq(userPokemon.accountId, accountId), isNotNull(userPokemon.boxNumber)));

        const occupied = new Set(existingBoxPokemon.map((p) => `${p.boxNumber}:${p.gridNumber}`));

        outer: for (let b = 1; b <= PC_STORAGE.MAX_BOX; b++) {
          for (let g = 0; g < PC_STORAGE.GRID_PER_BOX; g++) {
            if (!occupied.has(`${b}:${g}`)) {
              targetBox = b;
              targetGrid = g;
              break outer;
            }
          }
        }

        if (targetBox === null) {
          throw new AppError('Pokemon storage is full', 409, AppErrorCode.POKEMON_BOX_FULL);
        }
      }

      const [inserted] = await tx
        .insert(userPokemon)
        .values({
          accountId,
          pokedexId: recipe.pokedexId,
          level,
          exp: totalExpForLevel(level, pokemonData.growthGroup),
          gender,
          isShiny,
          nickname: null,
          abilityId: ability,
          natureId: nature,
          skills: [],
          heldItemId: null,
          boxNumber: targetBox,
          gridNumber: targetGrid,
          partySlot: targetPartySlot,
          ballId: 1,
          caughtLocation,
        })
        .returning();

      await tx
        .insert(userPokedex)
        .values({ accountId, pokedexId: recipe.pokedexId, caughtCount: 1 })
        .onConflictDoUpdate({
          target: [userPokedex.accountId, userPokedex.pokedexId],
          set: { caughtCount: sql`${userPokedex.caughtCount} + 1` },
        });

      await auditTx(tx, {
        accountId,
        action: AuditAction.FOSSIL_RESTORE,
        detail: {
          recipeId: id,
          userPokemonId: inserted.id,
          pokedexId: recipe.pokedexId,
          level,
          isShiny,
        },
        ip: ip ?? null,
        source: 'api',
      });

      return inserted;
    });

    return { pokemon: insertedPokemon };
  }
}

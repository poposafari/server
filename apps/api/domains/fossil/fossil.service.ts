import { sql, eq, and, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@poposerver/lib/db';
import { user, userItem, userPokemon, userPokedex } from '@poposerver/lib/schema';
import { MasterData } from '@poposerver/lib/utils/master-data';
import { AppError } from '@poposerver/lib/utils/error';
import { AppErrorCode, PokemonNatural } from '@poposerver/lib/types';
import { rollGender, rollSafariShiny, randomInt, pickOne } from '@poposerver/lib/utils/rng';
import { LEVEL_CURVE } from '@poposerver/lib/constants/level-curve';
import { getUserState } from '@poposerver/lib/redis';
import { FOSSIL_RECIPES } from './fossil.recipe';

const MAX_BOX = 30;
const GRID_PER_BOX = 30;

export class FossilService {
  async restore(
    authId: string,
    id: number,
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
      .where(
        and(eq(userItem.accountId, accountId), inArray(userItem.itemId, recipe.ingredients)),
      );
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

    // 사파리 야생 결정과 동일하게 롤링
    const [userRow] = await db
      .select({ level: user.level })
      .from(user)
      .where(eq(user.accountId, accountId));
    const userLevel = userRow?.level ?? 1;
    const { min: wildMin, max: wildMax } = LEVEL_CURVE.wildLevelRange(userLevel);
    const level = randomInt(wildMin, wildMax);
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

      // box/grid 탐색 (safari catch와 동일)
      const existingBoxPokemon = await tx
        .select({ boxNumber: userPokemon.boxNumber, gridNumber: userPokemon.gridNumber })
        .from(userPokemon)
        .where(and(eq(userPokemon.accountId, accountId), isNotNull(userPokemon.boxNumber)));

      const occupied = new Set(
        existingBoxPokemon.map((p) => `${p.boxNumber}:${p.gridNumber}`),
      );

      let targetBox = 1;
      let targetGrid = 0;
      outer: for (let b = 1; b <= MAX_BOX; b++) {
        for (let g = 0; g < GRID_PER_BOX; g++) {
          if (!occupied.has(`${b}:${g}`)) {
            targetBox = b;
            targetGrid = g;
            break outer;
          }
        }
      }

      const [inserted] = await tx
        .insert(userPokemon)
        .values({
          accountId,
          pokedexId: recipe.pokedexId,
          level,
          gender,
          isShiny,
          nickname: null,
          abilityId: ability,
          natureId: nature,
          skills: [],
          heldItemId: null,
          boxNumber: targetBox,
          gridNumber: targetGrid,
          partySlot: null,
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

      return inserted;
    });

    return { pokemon: insertedPokemon };
  }
}

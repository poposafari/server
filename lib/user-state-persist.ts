import { eq, sql, and, notInArray, isNotNull, inArray } from 'drizzle-orm';
import { db } from './db';
import { user, userPokemon, userItem, userCostume } from './schema';
import { getUserState, deleteUserState } from './redis';
import { logger } from './utils/logger';

export interface PersistUserStateOptions {
  deleteFromRedis?: boolean;
}

export async function persistUserStateFromRedisToDb(
  authId: string,
  options: PersistUserStateOptions = {},
): Promise<void> {
  const { deleteFromRedis = true } = options;
  const state = await getUserState(authId);
  if (!state) return;

  const accountId = Number(authId);
  const x = Number(state.x) || 0;
  const y = Number(state.y) || 0;

  let deltaSeconds = 0;
  if (state.createdAt) {
    const sessionStart = new Date(state.createdAt).getTime();
    const now = Date.now();
    deltaSeconds = Math.max(0, Math.floor((now - sessionStart) / 1000));
  }

  // Redis에서 party, itemSlots, costume 파싱
  const party: { id: number }[] = state.party ? JSON.parse(state.party) : [];
  const itemSlots: { itemId: number }[] = state.itemSlots ? JSON.parse(state.itemSlots) : [];
  const costume: { costumeId: string }[] = state.costume ? JSON.parse(state.costume) : [];

  await db.transaction(async (tx) => {
    // 1. user 테이블 업데이트 (위치, 플레이타임)
    await tx
      .update(user)
      .set({
        lastMapId: state.mapId,
        lastX: x,
        lastY: y,
        playtime: sql`${user.playtime} + ${deltaSeconds}`,
      })
      .where(eq(user.accountId, accountId));

    // 2. party → user_pokemon.party_slot
    const partyPokemonIds = party.map((p) => p.id);
    for (let slot = 0; slot < party.length; slot++) {
      await tx
        .update(userPokemon)
        .set({ partySlot: slot })
        .where(and(eq(userPokemon.id, party[slot].id), eq(userPokemon.accountId, accountId)));
    }
    if (partyPokemonIds.length > 0) {
      await tx
        .update(userPokemon)
        .set({ partySlot: null })
        .where(
          and(
            eq(userPokemon.accountId, accountId),
            notInArray(userPokemon.id, partyPokemonIds),
            isNotNull(userPokemon.partySlot),
          ),
        );
    } else {
      await tx
        .update(userPokemon)
        .set({ partySlot: null })
        .where(and(eq(userPokemon.accountId, accountId), isNotNull(userPokemon.partySlot)));
    }

    // 3. itemSlots → user_item.slot_number
    const slotItemIds = itemSlots.map((s) => s.itemId);
    for (let slot = 0; slot < itemSlots.length; slot++) {
      await tx
        .update(userItem)
        .set({ slotNumber: slot })
        .where(
          and(eq(userItem.accountId, accountId), eq(userItem.itemId, itemSlots[slot].itemId)),
        );
    }
    if (slotItemIds.length > 0) {
      await tx
        .update(userItem)
        .set({ slotNumber: null })
        .where(
          and(
            eq(userItem.accountId, accountId),
            notInArray(userItem.itemId, slotItemIds),
            isNotNull(userItem.slotNumber),
          ),
        );
    } else {
      await tx
        .update(userItem)
        .set({ slotNumber: null })
        .where(and(eq(userItem.accountId, accountId), isNotNull(userItem.slotNumber)));
    }

    // 4. costume → user_costume.is_equipped
    const equippedCostumeIds = costume.map((c) => c.costumeId);
    if (equippedCostumeIds.length > 0) {
      await tx
        .update(userCostume)
        .set({ isEquipped: true })
        .where(
          and(
            eq(userCostume.accountId, accountId),
            inArray(userCostume.costumeId, equippedCostumeIds),
          ),
        );
      await tx
        .update(userCostume)
        .set({ isEquipped: false })
        .where(
          and(
            eq(userCostume.accountId, accountId),
            notInArray(userCostume.costumeId, equippedCostumeIds),
          ),
        );
    } else {
      await tx
        .update(userCostume)
        .set({ isEquipped: false })
        .where(eq(userCostume.accountId, accountId));
    }
  });

  if (deleteFromRedis) await deleteUserState(authId);
  logger.debug(`[persistUserState] Saved state for authId=${authId}`);
}

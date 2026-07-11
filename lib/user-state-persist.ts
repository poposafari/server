import { eq, sql, and, inArray, notInArray } from 'drizzle-orm';
import { db } from './db';
import { user, userCostume, userTownMap } from './schema';
import { getUserState, deleteUserState, setUserStateCreatedAt } from './state';
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

  const now = Date.now();
  let deltaSeconds = 0;
  if (state.createdAt) {
    const sessionStart = new Date(state.createdAt).getTime();
    deltaSeconds = Math.max(0, Math.floor((now - sessionStart) / 1000));
  }

  // Redis에서 costume 파싱
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

    // 4. visitedMaps → user_town_map (사파리존 s* 맵만 기록)
    const visitedMaps: string[] = (state.visitedMaps ? JSON.parse(state.visitedMaps) : []).filter(
      (mapId: string | null): mapId is string => mapId != null && mapId.startsWith('s'),
    );
    if (visitedMaps.length > 0) {
      const values = visitedMaps.map((mapId) => ({ accountId, mapId }));
      await tx
        .insert(userTownMap)
        .values(values)
        .onConflictDoNothing({
          target: [userTownMap.accountId, userTownMap.mapId],
        });
    }

    // 5. costume → user_costume.is_equipped
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

  if (deleteFromRedis) {
    await deleteUserState(authId);
  } else {
    await setUserStateCreatedAt(authId, new Date(now).toISOString());
  }
  logger.debug(`[persistUserState] Saved state for authId=${authId}`);
}

import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { user } from './schema';
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

  await db
    .update(user)
    .set({
      lastMapId: state.mapId,
      lastX: x,
      lastY: y,
      playtime: sql`${user.playtime} + ${deltaSeconds}`,
    })
    .where(eq(user.accountId, accountId));

  if (deleteFromRedis) await deleteUserState(authId);
  logger.debug(`[persistUserState] Saved state for authId=${authId}`);
}

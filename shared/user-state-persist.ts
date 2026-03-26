import { DataSource } from 'typeorm';
import { getUserState, deleteUserState } from './redis';
import { User } from './entities/user.entity';
import type { UserLocationData, UserCostumeData } from './types';
import { logger } from '../lib/utils/logger';

export interface PersistUserStateOptions {
  deleteFromRedis?: boolean;
}

export async function persistUserStateFromRedisToDb(
  authId: string,
  dataSource: DataSource,
  options: PersistUserStateOptions = {},
): Promise<void> {
  const { deleteFromRedis = true } = options;
  const state = await getUserState(authId);
  if (!state) return;

  const userRepo = dataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { authId } });
  if (!user) {
    logger.warn(`[persistUserState] User not found for authId=${authId}, skipping DB update`);
    if (deleteFromRedis) await deleteUserState(authId);
    return;
  }

  const lastLocation: UserLocationData = {
    map: state.mapId || user.lastLocation?.map || 'p003',
    x: Number(state.x) || 0,
    y: Number(state.y) || 0,
  };
  user.lastLocation = lastLocation;

  if (state.costume) {
    try {
      const parsed = JSON.parse(state.costume) as UserCostumeData;
      if (
        typeof parsed?.skin === 'string' &&
        typeof parsed?.hair === 'string' &&
        typeof parsed?.hairColor === 'string' &&
        typeof parsed?.outfit === 'string'
      ) {
        user.lastCostume = parsed;
      }
    } catch {
      // invalid JSON or shape; keep existing lastCostume
    }
  }

  if (state.createdAt) {
    const sessionStart = new Date(state.createdAt).getTime();
    const now = Date.now();
    const deltaSeconds = Math.max(0, Math.floor((now - sessionStart) / 1000));
    user.playTime = (user.playTime ?? 0) + deltaSeconds;
  }

  await userRepo.save(user);
  if (deleteFromRedis) await deleteUserState(authId);
  logger.debug(`[persistUserState] Saved state for authId=${authId}`);
}

import { eq } from 'drizzle-orm';
import { user } from '../schema';
import { LEVEL_CURVE } from '../constants/level-curve';

export interface ApplyExpResult {
  level: number;
  exp: number;
  gained: number;
  leveledUp: boolean;
}

export function computeApplyExp(curLevel: number, curExp: number, gain: number): ApplyExpResult {
  const safeGain = Math.max(0, Math.floor(gain));
  let level = curLevel;
  let exp = curExp + safeGain;

  while (level < LEVEL_CURVE.USER_LEVEL_MAX) {
    const need = LEVEL_CURVE.expToNext(level);
    if (exp < need) break;
    exp -= need;
    level += 1;
  }

  if (level >= LEVEL_CURVE.USER_LEVEL_MAX) {
    level = LEVEL_CURVE.USER_LEVEL_MAX;
    exp = 0;
  }

  return {
    level,
    exp,
    gained: safeGain,
    leveledUp: level > curLevel,
  };
}

type DbLike = {
  select: (...args: any[]) => any;
  update: (...args: any[]) => any;
};

export async function applyUserExp(
  tx: DbLike,
  accountId: number,
  gain: number,
): Promise<ApplyExpResult> {
  const [row] = await tx
    .select({ level: user.level, exp: user.exp })
    .from(user)
    .where(eq(user.accountId, accountId));

  const result = computeApplyExp(row.level, row.exp, gain);

  await tx
    .update(user)
    .set({ level: result.level, exp: result.exp })
    .where(eq(user.accountId, accountId));

  return result;
}

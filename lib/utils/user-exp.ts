import { eq, sql } from 'drizzle-orm';
import { user } from '../schema/user';
import { AuditAction } from '../types/audit.type';
import { auditTx, type Tx } from './audit';
import { USER_EXP_MAX, userExpProgress, userLevelFromExp, utcDateString } from './user-exp-curve';

const DAILY_CAPTURE_COUNT_MAX = 32_767;

export type UserExpSource = 'capture' | 'quest';

export interface UserExpGrantResult {
  gained: number;
  level: number;
  exp: number;
  expMax: number;
  leveledUp: boolean;
}

export async function grantUserExp(
  tx: Tx,
  accountId: number,
  amount: number,
  source: UserExpSource,
): Promise<UserExpGrantResult> {
  const [row] = await tx
    .select({ exp: user.exp })
    .from(user)
    .where(eq(user.accountId, accountId))
    .for('update');
  if (!row) throw new Error(`user not found: accountId=${accountId}`);

  const prevExp = row.exp;
  const newExp = Math.min(prevExp + Math.max(0, Math.floor(amount)), USER_EXP_MAX);
  const gained = newExp - prevExp;

  if (gained > 0) {
    await tx.update(user).set({ exp: newExp }).where(eq(user.accountId, accountId));
  }

  const fromLevel = userLevelFromExp(prevExp);
  const toLevel = userLevelFromExp(newExp);
  const leveledUp = toLevel > fromLevel;

  if (leveledUp) {
    await auditTx(tx, {
      accountId,
      action: AuditAction.USER_LEVEL_UP,
      detail: { fromLevel, toLevel, exp: newExp, gained, source },
      source: 'api',
    });
  }

  return { gained, ...userExpProgress(newExp), leveledUp };
}

export async function bumpDailyCaptureCount(
  tx: Tx,
  accountId: number,
  now: Date,
): Promise<{ nth: number; exp: number }> {
  const today = utcDateString(now);
  const [row] = await tx
    .update(user)
    .set({
      dailyCaptureCount: sql`CASE WHEN ${user.dailyCaptureDate} = ${today}::date THEN LEAST(${user.dailyCaptureCount} + 1, ${DAILY_CAPTURE_COUNT_MAX}) ELSE 1 END`,
      dailyCaptureDate: today,
    })
    .where(eq(user.accountId, accountId))
    .returning({ nth: user.dailyCaptureCount, exp: user.exp });
  if (!row) throw new Error(`user not found: accountId=${accountId}`);
  return row;
}

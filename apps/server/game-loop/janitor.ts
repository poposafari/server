import { sql } from 'drizzle-orm';
import {
  db,
  getAllActivePlayers,
  getUserState,
  hasConnReservedGrace,
  logger,
  pruneExpiredSessions,
  removeActivePlayer,
} from '@poposerver/lib';

// janitor 주기 (ms)
const SLOT_CLEANUP_INTERVAL_MS = 30_000;

// audit_log / 만료 세션 보존 주기 (1일 1회)
const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;

// audit_log 보존 기간(일)
const AUDIT_RETENTION_DAYS = 60;

export async function cleanupStaleSlots(): Promise<void> {
  const members = await getAllActivePlayers();
  let reclaimed = 0;
  for (const authId of members) {
    const state = await getUserState(authId);
    if (state && state.socketId) continue;
    if (await hasConnReservedGrace(authId)) continue;
    await removeActivePlayer(authId);
    reclaimed++;
  }
  if (reclaimed > 0) {
    logger.info(`[Janitor] cleanupStaleSlots reclaimed=${reclaimed}`);
  }
}

export async function pruneAuditLog(): Promise<void> {
  await db.execute(
    sql`DELETE FROM audit_log WHERE created_at < now() - make_interval(days => ${AUDIT_RETENTION_DAYS})`,
  );
  logger.info(`[Janitor] pruneAuditLog done (retention=${AUDIT_RETENTION_DAYS}d)`);
}

async function runDaily(): Promise<void> {
  await pruneAuditLog();
  await pruneExpiredSessions();
}

function startLoop(
  name: string,
  intervalMs: number,
  fn: () => Promise<void>,
  runOnStart = false,
): () => Promise<void> {
  let running = false;
  let stopped = false;

  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      await fn();
    } catch (err) {
      logger.error(`[Janitor] ${name} crashed:`, err);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, intervalMs);

  if (runOnStart) void tick();
  logger.info(`[Janitor] ${name} loop started: every ${intervalMs}ms (runOnStart=${runOnStart})`);

  return async () => {
    stopped = true;
    clearInterval(timer);
    while (running) await new Promise((r) => setTimeout(r, 50));
  };
}

export function startJanitorLoops(): () => Promise<void> {
  const stopSlot = startLoop('cleanupStaleSlots', SLOT_CLEANUP_INTERVAL_MS, cleanupStaleSlots);

  const stopDaily = startLoop('dailyPrune', DAILY_INTERVAL_MS, runDaily, true);

  return async () => {
    await stopSlot();
    await stopDaily();
  };
}

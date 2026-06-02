import { sql } from 'drizzle-orm';
import {
  db,
  getAllActivePlayers,
  getUserState,
  hasConnReservedGrace,
  logger,
  removeActivePlayer,
} from '@poposerver/lib';

//janitor 주기 (ms)
const SLOT_CLEANUP_INTERVAL_MS = 30_000;

// audit_log 보존 주기 (1일 1회)
const AUDIT_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

// audit_log 보존 기간(일)
const AUDIT_RETENTION_DAYS = 60;

export async function cleanupStaleSlots(): Promise<void> {
  const members = await getAllActivePlayers();
  let reclaimed = 0;
  for (const authId of members) {
    const state = await getUserState(authId);
    if (state && state.socketId) continue; // 살아있는 연결
    if (await hasConnReservedGrace(authId)) continue; // 아직 grace 안
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

function startLoop(name: string, intervalMs: number, fn: () => Promise<void>): () => Promise<void> {
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
  logger.info(`[Janitor] ${name} loop started: every ${intervalMs}ms`);

  return async () => {
    stopped = true;
    clearInterval(timer);
    while (running) await new Promise((r) => setTimeout(r, 50));
  };
}

export function startJanitorLoops(): () => Promise<void> {
  const stopSlot = startLoop('cleanupStaleSlots', SLOT_CLEANUP_INTERVAL_MS, cleanupStaleSlots);
  const stopAudit = startLoop('pruneAuditLog', AUDIT_RETENTION_INTERVAL_MS, pruneAuditLog);

  return async () => {
    await stopSlot();
    await stopAudit();
  };
}

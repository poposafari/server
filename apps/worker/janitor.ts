import {
  envConfig,
  getAllActivePlayers,
  getStaleQueueMembers,
  getUserState,
  hasConnReservedGrace,
  logger,
  promoteOneFromQueue,
  removeActivePlayer,
  removeFromQueue,
} from '@poposerver/lib';

/** janitor 주기 (ms) */
const SLOT_CLEANUP_INTERVAL_MS = 30_000;
const QUEUE_CLEANUP_INTERVAL_MS = 10_000;
const PROMOTE_INTERVAL_MS = 1_000;

/** 큐 폴링이 끊긴 사용자를 stale로 간주하는 임계 (ms). 클라이언트 폴링 주기(3s) × 약 6회분. */
const QUEUE_STALE_CUTOFF_MS = 20_000;

/**
 * active:players 누수 정리.
 * `/api/game/connect`가 SADD했지만 30초 grace 안에 소켓 핸드셰이크에 실패한 사용자를 회수한다.
 * 조건: state가 없거나 socketId가 비어있고, conn:reserved grace 키도 없을 때.
 * grace 키는 핸드셰이크 성공 시 DEL되므로, "grace 만료 + state도 없음" = 슬롯 누수.
 */
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

/**
 * 큐 폴링이 끊긴 사용자를 큐에서 제거.
 * lastSeen score가 (now - QUEUE_STALE_CUTOFF_MS) 미만이면 polling이 멈춘 것으로 본다.
 */
export async function cleanupStaleQueue(): Promise<void> {
  const cutoff = Date.now() - QUEUE_STALE_CUTOFF_MS;
  const stale = await getStaleQueueMembers(cutoff);
  if (stale.length === 0) return;
  await removeFromQueue(stale);
  logger.info(`[Janitor] cleanupStaleQueue removed=${stale.length}`);
}

/**
 * 슬롯이 비었으면 큐 첫 N명을 active로 이동.
 * Lua 안에서 SCARD/ZRANGE/ZREM/SADD/SETEX가 한 트랜잭션으로 처리되므로
 * 동시 cleanupStaleSlots와의 race가 없다. (SETEX로 grace 키도 함께 깔린다)
 */
export async function promoteFromQueue(): Promise<void> {
  const capacity = envConfig.SLOT_CAPACITY;
  let promoted = 0;
  // 한 cycle에 너무 많이 promote하면 thundering herd 위험 → 작은 batch로 끊는다.
  const MAX_PER_CYCLE = 20;
  for (let i = 0; i < MAX_PER_CYCLE; i++) {
    const authId = await promoteOneFromQueue(capacity);
    if (!authId) break;
    promoted++;
    logger.info(`[Janitor] promoted from queue: ${authId}`);
  }
  if (promoted > 0) {
    logger.info(`[Janitor] promoteFromQueue total=${promoted}`);
  }
}

/** N ms마다 fn을 호출. 동시 실행을 막고 stopped 플래그로 정지한다. */
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
  const stopQueue = startLoop('cleanupStaleQueue', QUEUE_CLEANUP_INTERVAL_MS, cleanupStaleQueue);
  const stopPromote = startLoop('promoteFromQueue', PROMOTE_INTERVAL_MS, promoteFromQueue);

  return async () => {
    await Promise.all([stopSlot(), stopQueue(), stopPromote()]);
  };
}

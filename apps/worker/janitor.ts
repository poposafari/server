import {
  getAllActivePlayers,
  getUserState,
  hasConnReservedGrace,
  logger,
  removeActivePlayer,
} from '@poposerver/lib';

/** janitor 주기 (ms) */
const SLOT_CLEANUP_INTERVAL_MS = 30_000;

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

  return async () => {
    await stopSlot();
  };
}

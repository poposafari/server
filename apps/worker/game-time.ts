import { TimeOfDay } from '@poposerver/lib/types/game.type';
import { GameTimeState, setGameTime, publishGameTime } from '@poposerver/lib';
import { logger } from '@poposerver/lib';

const CYCLE_MS = 7_200_000; // 120분

const PHASES: { name: TimeOfDay; duration: number }[] = [
  { name: TimeOfDay.DAWN, duration: 1_200_000 },
  { name: TimeOfDay.DAY, duration: 2_400_000 },
  { name: TimeOfDay.DUSK, duration: 1_200_000 },
  { name: TimeOfDay.NIGHT, duration: 2_400_000 },
];

function getCurrentPhaseState(): GameTimeState {
  const now = Date.now();
  const offset = now % CYCLE_MS;
  let cumulative = 0;
  for (const phase of PHASES) {
    const phaseStart = cumulative;
    cumulative += phase.duration;
    if (offset < cumulative) {
      return {
        phase: phase.name,
        startedAt: now - (offset - phaseStart),
        duration: phase.duration,
      };
    }
  }
  return { phase: PHASES[0].name, startedAt: now, duration: PHASES[0].duration };
}

export function startGameTimeClock(): () => void {
  let currentState = getCurrentPhaseState();

  setGameTime(currentState);
  publishGameTime(currentState);
  logger.info(`[GAME_TIME] Initial phase: ${currentState.phase}`);

  const timer = setInterval(async () => {
    const next = getCurrentPhaseState();
    if (next.phase !== currentState.phase) {
      currentState = next;
      await setGameTime(next);
      await publishGameTime(next);
      logger.info(`[GAME_TIME] Phase changed to: ${next.phase}`);
    }
  }, 1000);

  return () => clearInterval(timer);
}

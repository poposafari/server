import { TimeOfDay } from '@poposerver/lib/types/game.type';
import { setGameTime, publishGameTime } from '@poposerver/lib';
import { logger } from '@poposerver/lib';

const CYCLE_MS = 7_200_000; // 120분

const PHASES: { name: TimeOfDay; duration: number }[] = [
  { name: TimeOfDay.DAWN, duration: 1_200_000 },
  { name: TimeOfDay.DAY, duration: 2_400_000 },
  { name: TimeOfDay.DUSK, duration: 1_200_000 },
  { name: TimeOfDay.NIGHT, duration: 2_400_000 },
];

function getCurrentPhase(): TimeOfDay {
  const offset = Date.now() % CYCLE_MS;
  let cumulative = 0;
  for (const phase of PHASES) {
    cumulative += phase.duration;
    if (offset < cumulative) return phase.name;
  }
  return TimeOfDay.DAWN;
}

export function startGameTimeClock(): () => void {
  let currentPhase = getCurrentPhase();

  setGameTime(currentPhase);
  publishGameTime(currentPhase);
  logger.info(`[GAME_TIME] Initial phase: ${currentPhase}`);

  const timer = setInterval(async () => {
    const phase = getCurrentPhase();
    if (phase !== currentPhase) {
      currentPhase = phase;
      await setGameTime(phase);
      await publishGameTime(phase);
      logger.info(`[GAME_TIME] Phase changed to: ${phase}`);
    }
  }, 1000);

  return () => clearInterval(timer);
}

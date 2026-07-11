// 게임 시간 — 저장하지 않고 Date.now()에서 순수 계산. (구 worker getCurrentPhaseState)
// 2시간 싸이클: DAWN 20 / DAY 40 / DUSK 20 / NIGHT 40 분.

import { TimeOfDay } from '../types/game.type';
import { GameTimeState } from './types';

const CYCLE_MS = 7_200_000; // 120분

const PHASES: { name: TimeOfDay; duration: number }[] = [
  { name: TimeOfDay.DAWN, duration: 1_200_000 },
  { name: TimeOfDay.DAY, duration: 2_400_000 },
  { name: TimeOfDay.DUSK, duration: 1_200_000 },
  { name: TimeOfDay.NIGHT, duration: 2_400_000 },
];

export function getCurrentPhaseState(): GameTimeState {
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

/** seam 시그니처 보존: 기존 getGameTime 호출부(pokemon/safari/socket)는 그대로 둔다. */
export async function getGameTime(): Promise<GameTimeState> {
  return getCurrentPhaseState();
}

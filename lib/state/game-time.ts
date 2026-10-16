// 2시간 싸이클: DAWN 20 / DAY 40 / DUSK 20 / NIGHT 40 분.

import { redis } from '../redis';
import { TimeOfDay } from '../types/game.type';
import { logger } from '../utils/logger';
import { getMoonPhase } from './moon-phase';
import { GameTimeState } from './types';

const CYCLE_MS = 7_200_000; // 120분
const KEY = 'game-time';

const PHASES: { name: TimeOfDay; duration: number }[] = [
  { name: TimeOfDay.DAWN, duration: 1_200_000 },
  { name: TimeOfDay.DAY, duration: 2_400_000 },
  { name: TimeOfDay.DUSK, duration: 1_200_000 },
  { name: TimeOfDay.NIGHT, duration: 2_400_000 },
];

let current: GameTimeState | null = null;

export function getCurrentPhaseState(now: number = Date.now()): GameTimeState {
  const offset = now % CYCLE_MS;
  let cumulative = 0;
  for (const phase of PHASES) {
    const phaseStart = cumulative;
    cumulative += phase.duration;
    if (offset < cumulative) {
      const startedAt = now - (offset - phaseStart);
      return {
        phase: phase.name,
        startedAt,
        duration: phase.duration,
        moonPhase: getMoonPhase(startedAt),
      };
    }
  }
  return {
    phase: PHASES[0].name,
    startedAt: now,
    duration: PHASES[0].duration,
    moonPhase: getMoonPhase(now),
  };
}

function parseGameTime(raw: string): GameTimeState | null {
  try {
    const v = JSON.parse(raw) as Partial<GameTimeState>;
    if (
      typeof v.phase === 'string' &&
      typeof v.startedAt === 'number' &&
      typeof v.duration === 'number' &&
      typeof v.moonPhase === 'number'
    ) {
      return {
        phase: v.phase,
        startedAt: v.startedAt,
        duration: v.duration,
        moonPhase: v.moonPhase,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function getCachedGameTime(): GameTimeState | null {
  return current;
}

export function getGameTime(): GameTimeState {
  if (!current) throw new Error('Game time is not loaded from Redis yet');
  return current;
}

export async function loadStoredGameTime(): Promise<GameTimeState | null> {
  const raw = await redis.get(KEY);
  if (raw === null) return null;
  const state = parseGameTime(raw);
  if (!state) logger.warn('[GAME_TIME] ignored invalid stored value');
  return state;
}

export function restoreGameTime(state: GameTimeState): void {
  current = state;
}

export async function setGameTime(state: GameTimeState): Promise<void> {
  await redis.set(KEY, JSON.stringify(state), 'PXAT', state.startedAt + state.duration);
  current = state;
}

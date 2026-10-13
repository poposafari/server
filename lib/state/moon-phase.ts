const MOON_PHASE_MS = 21_600_000;

export const MOON_PHASE_COUNT = 8;
export const MOON_PHASE_NEW = 0;
export const MOON_PHASE_FULL = 4;

export function getMoonPhase(now: number = Date.now()): number {
  return Math.floor(now / MOON_PHASE_MS) % MOON_PHASE_COUNT;
}

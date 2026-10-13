import { PokemonGender, TimeOfDay } from '../types/game.type';
import { MOON_PHASE_FULL } from '../state/moon-phase';

export const SAFARI_BALL_ID = 'safari-ball';

export const BALL_NUMBERS = {
  'safari-ball': 1,
  'beast-ball': 2,
  'dive-ball': 3,
  'dream-ball': 4,
  'dusk-ball': 5,
  'fast-ball': 6,
  'friend-ball': 7,
  'heavy-ball': 8,
  'level-ball': 9,
  'love-ball': 10,
  'lure-ball': 11,
  'moon-ball': 12,
  'nest-ball': 13,
  'net-ball': 14,
  'quick-ball': 15,
  'repeat-ball': 16,
  'timer-ball': 17,
} as const;

export type BallId = keyof typeof BALL_NUMBERS;

export const BALL_IDS = Object.keys(BALL_NUMBERS) as BallId[];

export function isBallId(id: string): id is BallId {
  return Object.prototype.hasOwnProperty.call(BALL_NUMBERS, id);
}

export const BALL_MUL = {
  LEVEL_LOWER: 1.5,
  LEVEL_HALF: 2.5,
  LEVEL_QUARTER: 4,
  MOON: 2,
  MOON_FULL_NIGHT: 2,
  LURE: 3,
  LOVE: 4,
  FAST: 4,
  HEAVY_UNDER_100: 0.5,
  HEAVY_200: 2,
  HEAVY_300: 4,
  NET: 3,
  NEST_MAX: 4,
  REPEAT: 3,
  TIMER_STEP: 1229 / 4096,
  TIMER_MAX: 4,
  DIVE: 3,
  QUICK: 4,
  DUSK: 3,
  DREAM: 2.5,
  BEAST: 5,
};

export const FRIEND_BALL_FRIENDSHIP = 200;

export const FAST_BALL_SPECIES = new Set<number>([
  6, 18, 22, 26, 38, 51, 53, 64, 65, 73, 78, 85, 94, 100, 101, 121, 123, 125, 128, 135, 142, 145,
  150, 151, 157, 169, 189, 196, 215, 241, 243, 244, 249, 251, 254, 264, 277, 289, 291, 310, 330,
  373, 380, 381, 385, 386, 392, 398, 419, 424, 428, 429, 432, 445, 461, 478, 482, 484, 486, 490,
  491, 492, 493, 494, 497, 510, 512, 514, 516, 523, 528, 545, 547, 567, 571, 573, 587, 596, 615,
  617, 620, 632, 637, 638, 639, 640, 641, 642, 645, 647, 655, 658, 663, 668, 676, 678, 695, 701,
  702, 715, 743, 745, 758, 764, 785, 793, 795, 798, 802, 804, 806, 807, 815, 818, 836, 847, 886,
  887, 888, 889, 890, 893, 894, 897, 903, 905, 908, 923, 925, 941, 945, 949, 956, 961, 964, 967,
  985, 987, 989, 990, 991, 993, 994, 1002, 1004, 1005, 1006, 1007, 1008, 1009, 1010, 1015, 1017,
  1022,
]);

export const BEAST_BALL_SPECIES = new Set<number>([
  793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806,
]);

export const MOON_BALL_SPECIES = new Set<number>([30, 33, 35, 39, 300, 517]);

export const NET_BALL_TYPES = ['water', 'bug'];

export const DUSK_BALL_MAP_IDS: string[] = [];
export const DIVE_BALL_MAP_IDS: string[] = [];
export const DREAM_BALL_MAP_IDS: string[] = [];

export interface BallContext {
  pokedexId: string;
  level: number;
  gender: number;
  turn: number;
  types: Array<string | null>;
  weightKg: number;
  trainerLevel: number;
  lead: { pokedexId: string; gender: number } | null;
  caughtBefore: boolean;
  mapId: string;
  timeOfDay: string;
  moonPhase: number;
  spawnTile: string | null;
}

export function speciesNumber(pokedexId: string): number {
  return parseInt(pokedexId, 10);
}

function levelBallMul(level: number, trainerLevel: number): number {
  if (level >= trainerLevel) return 1;
  if (level * 4 <= trainerLevel) return BALL_MUL.LEVEL_QUARTER;
  if (level * 2 <= trainerLevel) return BALL_MUL.LEVEL_HALF;
  return BALL_MUL.LEVEL_LOWER;
}

function moonBallMul(ctx: BallContext): number {
  if (!MOON_BALL_SPECIES.has(speciesNumber(ctx.pokedexId))) return 1;
  const fullMoonNight = ctx.moonPhase === MOON_PHASE_FULL && ctx.timeOfDay === TimeOfDay.NIGHT;
  return BALL_MUL.MOON * (fullMoonNight ? BALL_MUL.MOON_FULL_NIGHT : 1);
}

function loveBallMul(ctx: BallContext): number {
  const lead = ctx.lead;
  if (!lead || lead.pokedexId !== ctx.pokedexId) return 1;
  if (ctx.gender === PokemonGender.NONE || lead.gender === PokemonGender.NONE) return 1;
  return ctx.gender === lead.gender ? 1 : BALL_MUL.LOVE;
}

function heavyBallMul(weightKg: number): number {
  if (weightKg < 100) return BALL_MUL.HEAVY_UNDER_100;
  if (weightKg < 200) return 1;
  if (weightKg < 300) return BALL_MUL.HEAVY_200;
  return BALL_MUL.HEAVY_300;
}

function nestBallMul(level: number): number {
  if (level >= 31) return 1;
  return Math.min(BALL_MUL.NEST_MAX, (41 - level) / 10);
}

function timerBallMul(turn: number): number {
  return Math.min(BALL_MUL.TIMER_MAX, 1 + (turn - 1) * BALL_MUL.TIMER_STEP);
}

export function ballCaptureMul(ballId: BallId, ctx: BallContext): number {
  switch (ballId) {
    case 'level-ball':
      return levelBallMul(ctx.level, ctx.trainerLevel);
    case 'moon-ball':
      return moonBallMul(ctx);
    case 'lure-ball':
      return ctx.spawnTile === 'water' ? BALL_MUL.LURE : 1;
    case 'love-ball':
      return loveBallMul(ctx);
    case 'fast-ball':
      return FAST_BALL_SPECIES.has(speciesNumber(ctx.pokedexId)) ? BALL_MUL.FAST : 1;
    case 'heavy-ball':
      return heavyBallMul(ctx.weightKg);
    case 'net-ball':
      return ctx.types.some((t) => t !== null && NET_BALL_TYPES.includes(t)) ? BALL_MUL.NET : 1;
    case 'nest-ball':
      return nestBallMul(ctx.level);
    case 'repeat-ball':
      return ctx.caughtBefore ? BALL_MUL.REPEAT : 1;
    case 'timer-ball':
      return timerBallMul(ctx.turn);
    case 'dive-ball':
      return DIVE_BALL_MAP_IDS.includes(ctx.mapId) ? BALL_MUL.DIVE : 1;
    case 'quick-ball':
      return ctx.turn === 1 ? BALL_MUL.QUICK : 1;
    case 'dusk-ball':
      return ctx.timeOfDay === TimeOfDay.NIGHT || DUSK_BALL_MAP_IDS.includes(ctx.mapId)
        ? BALL_MUL.DUSK
        : 1;
    case 'dream-ball':
      return DREAM_BALL_MAP_IDS.includes(ctx.mapId) ? BALL_MUL.DREAM : 1;
    case 'beast-ball':
      return BEAST_BALL_SPECIES.has(speciesNumber(ctx.pokedexId)) ? BALL_MUL.BEAST : 1;
    default:
      return 1;
  }
}

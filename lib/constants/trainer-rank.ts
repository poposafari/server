export type TrainerRankKey =
  | 'apprentice'
  | 'researcher'
  | 'seniorResearcher'
  | 'explorer'
  | 'veteranExplorer'
  | 'expeditionLeader'
  | 'safariAuthority';

export const TRAINER_RANK_STEPS: ReadonlyArray<{
  minLevel: number;
  key: TrainerRankKey;
  safariEntryBalls: number;
}> = [
  { minLevel: 100, key: 'safariAuthority', safariEntryBalls: 40 },
  { minLevel: 81, key: 'expeditionLeader', safariEntryBalls: 35 },
  { minLevel: 61, key: 'veteranExplorer', safariEntryBalls: 30 },
  { minLevel: 41, key: 'explorer', safariEntryBalls: 25 },
  { minLevel: 26, key: 'seniorResearcher', safariEntryBalls: 20 },
  { minLevel: 11, key: 'researcher', safariEntryBalls: 15 },
  { minLevel: 1, key: 'apprentice', safariEntryBalls: 10 },
];

export function trainerRankStepOf(level: number): (typeof TRAINER_RANK_STEPS)[number] {
  return (
    TRAINER_RANK_STEPS.find((s) => level >= s.minLevel) ??
    TRAINER_RANK_STEPS[TRAINER_RANK_STEPS.length - 1]
  );
}

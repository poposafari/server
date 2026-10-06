import {
  USER_EXP_MAX,
  applyDailyCaptureMultiplier,
  calcUserCaptureExp,
  dailyCaptureMultiplier,
  isWithinCatchLevelCap,
  userExpProgress,
  userLevelFromExp,
  userTotalExpForLevel,
  utcDateString,
} from '../user-exp-curve';

const LEVELS = Array.from({ length: 100 }, (_, i) => i + 1);

describe('user-exp-curve', () => {
  describe('userTotalExpForLevel', () => {
    test('L1 = 0', () => {
      expect(userTotalExpForLevel(1)).toBe(0);
    });
    test('L100 = 744,876', () => {
      expect(userTotalExpForLevel(100)).toBe(744_876);
      expect(USER_EXP_MAX).toBe(744_876);
    });
    test('계획서 표 값', () => {
      expect(userTotalExpForLevel(10)).toBe(6_156);
      expect(userTotalExpForLevel(25)).toBe(43_776);
      expect(userTotalExpForLevel(40)).toBe(115_596);
      expect(userTotalExpForLevel(60)).toBe(264_556);
      expect(userTotalExpForLevel(80)).toBe(474_316);
      expect(userTotalExpForLevel(99)).toBe(729_904);
    });
    test('단조 증가', () => {
      for (let l = 2; l <= 100; l++) {
        expect(userTotalExpForLevel(l)).toBeGreaterThan(userTotalExpForLevel(l - 1));
      }
    });
    test('범위 클램프', () => {
      expect(userTotalExpForLevel(0)).toBe(0);
      expect(userTotalExpForLevel(-5)).toBe(0);
      expect(userTotalExpForLevel(101)).toBe(744_876);
      expect(userTotalExpForLevel(9999)).toBe(744_876);
    });
  });

  describe('userLevelFromExp', () => {
    test.each(LEVELS)('L%i 임계값 = L, 임계-1 = L-1', (l) => {
      expect(userLevelFromExp(userTotalExpForLevel(l))).toBe(l);
      if (l > 1) expect(userLevelFromExp(userTotalExpForLevel(l) - 1)).toBe(l - 1);
    });
    test('cap 초과 = 100', () => {
      expect(userLevelFromExp(USER_EXP_MAX + 1)).toBe(100);
      expect(userLevelFromExp(10_000_000)).toBe(100);
    });
    test('음수 = 1', () => {
      expect(userLevelFromExp(-1)).toBe(1);
      expect(userLevelFromExp(-100_000)).toBe(1);
    });
  });

  describe('userExpProgress', () => {
    test('신규 유저', () => {
      expect(userExpProgress(0)).toEqual({ level: 1, exp: 0, expMax: 76 });
    });
    test('레벨업 직후 exp = 0', () => {
      expect(userExpProgress(76)).toEqual({ level: 2, exp: 0, expMax: 228 });
    });
    test('레벨업 직전', () => {
      expect(userExpProgress(75)).toEqual({ level: 1, exp: 75, expMax: 76 });
    });
    test('Lv.99 → 다음 레벨까지 14,972', () => {
      expect(userExpProgress(729_904)).toEqual({ level: 99, exp: 0, expMax: 14_972 });
    });
    test('Lv.100은 0/0', () => {
      expect(userExpProgress(USER_EXP_MAX)).toEqual({ level: 100, exp: 0, expMax: 0 });
      expect(userExpProgress(USER_EXP_MAX + 500)).toEqual({ level: 100, exp: 0, expMax: 0 });
    });
  });

  describe('calcUserCaptureExp', () => {
    test('계획서 예: 야생 Lv.25 common', () => {
      expect(calcUserCaptureExp('common', 25, 1)).toBe(108);
      expect(calcUserCaptureExp('common', 25, 50)).toBe(30);
      expect(calcUserCaptureExp('common', 25, 99)).toBe(15);
    });
    test('유저 레벨이 오를수록 감소', () => {
      let prev = Infinity;
      for (let lu = 1; lu <= 100; lu += 11) {
        const v = calcUserCaptureExp('rare', 30, lu);
        expect(v).toBeLessThanOrEqual(prev);
        prev = v;
      }
    });
    test('티어가 높을수록 증가', () => {
      const tiers = [
        'common',
        'uncommon',
        'rare',
        'super-rare',
        'ultra-rare',
        'epic',
        'unique',
        'legendary',
      ] as const;
      let prev = 0;
      for (const t of tiers) {
        const v = calcUserCaptureExp(t, 30, 10);
        expect(v).toBeGreaterThan(prev);
        prev = v;
      }
    });
    test('최소 1', () => {
      expect(calcUserCaptureExp('common', 1, 100)).toBeGreaterThanOrEqual(1);
    });
  });

  describe('dailyCaptureMultiplier', () => {
    test('구간 경계', () => {
      expect(dailyCaptureMultiplier(1)).toBe(1);
      expect(dailyCaptureMultiplier(50)).toBe(1);
      expect(dailyCaptureMultiplier(51)).toBe(0.5);
      expect(dailyCaptureMultiplier(100)).toBe(0.5);
      expect(dailyCaptureMultiplier(101)).toBe(0);
      expect(dailyCaptureMultiplier(32_767)).toBe(0);
    });
  });

  describe('applyDailyCaptureMultiplier', () => {
    test('50회까지 그대로', () => {
      expect(applyDailyCaptureMultiplier(108, 50)).toBe(108);
    });
    test('51~100회 절반, 최소 1', () => {
      expect(applyDailyCaptureMultiplier(108, 51)).toBe(54);
      expect(applyDailyCaptureMultiplier(1, 51)).toBe(1);
    });
    test('101회~ 0', () => {
      expect(applyDailyCaptureMultiplier(108, 101)).toBe(0);
    });
  });

  describe('isWithinCatchLevelCap', () => {
    test('사용자 Lv + 15 까지는 포획 가능 (경계 포함)', () => {
      expect(isWithinCatchLevelCap(35, 20)).toBe(true);
      expect(isWithinCatchLevelCap(16, 1)).toBe(true);
    });
    test('사용자 Lv + 16 부터는 포획 불가', () => {
      expect(isWithinCatchLevelCap(36, 20)).toBe(false);
      expect(isWithinCatchLevelCap(17, 1)).toBe(false);
    });
    test('사용자보다 낮은 야생은 항상 포획 가능', () => {
      expect(isWithinCatchLevelCap(1, 50)).toBe(true);
    });
  });

  describe('utcDateString', () => {
    test('UTC 23:59 / 00:00 경계', () => {
      expect(utcDateString(new Date('2026-03-01T23:59:59.999Z'))).toBe('2026-03-01');
      expect(utcDateString(new Date('2026-03-02T00:00:00.000Z'))).toBe('2026-03-02');
    });
  });
});

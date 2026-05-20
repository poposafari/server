import {
  EXP_CANDY_VALUE,
  GrowthGroup,
  calcCaptureExp,
  expToNextLevel,
  isExpCandyId,
  levelFromExp,
  POKEMON_LEVEL_MAX,
  totalExpForLevel,
} from '../exp-curve';

describe('exp-curve', () => {
  describe('totalExpForLevel: L1 base', () => {
    const groups: GrowthGroup[] = [
      'fast',
      'medium_fast',
      'medium_slow',
      'slow',
      'erratic',
      'fluctuating',
    ];
    test.each(groups)('%s 그룹 L1 = 0', (g) => {
      expect(totalExpForLevel(1, g)).toBe(0);
    });
  });

  describe('totalExpForLevel: 본가 만렙(L100) 누적값', () => {
    test('fast → 800,000', () => {
      expect(totalExpForLevel(100, 'fast')).toBe(800_000);
    });
    test('medium_fast → 1,000,000', () => {
      expect(totalExpForLevel(100, 'medium_fast')).toBe(1_000_000);
    });
    test('medium_slow → 1,059,860', () => {
      expect(totalExpForLevel(100, 'medium_slow')).toBe(1_059_860);
    });
    test('slow → 1,250,000', () => {
      expect(totalExpForLevel(100, 'slow')).toBe(1_250_000);
    });
    test('erratic → 600,000', () => {
      expect(totalExpForLevel(100, 'erratic')).toBe(600_000);
    });
    test('fluctuating → 1,640,000', () => {
      expect(totalExpForLevel(100, 'fluctuating')).toBe(1_640_000);
    });
  });

  describe('totalExpForLevel: 단조 증가', () => {
    const groups: GrowthGroup[] = [
      'fast',
      'medium_fast',
      'medium_slow',
      'slow',
      'erratic',
      'fluctuating',
    ];
    test.each(groups)('%s 그룹은 L에 대해 단조 증가', (g) => {
      let prev = -1;
      for (let L = 1; L <= POKEMON_LEVEL_MAX; L++) {
        const cur = totalExpForLevel(L, g);
        expect(cur).toBeGreaterThan(prev);
        prev = cur;
      }
    });
  });

  describe('totalExpForLevel: 범위 클램프', () => {
    test('L<1은 L=1로 취급', () => {
      expect(totalExpForLevel(0, 'medium_fast')).toBe(0);
      expect(totalExpForLevel(-5, 'medium_fast')).toBe(0);
    });
    test('L>100은 L=100으로 취급', () => {
      expect(totalExpForLevel(101, 'medium_fast')).toBe(1_000_000);
      expect(totalExpForLevel(9999, 'slow')).toBe(1_250_000);
    });
  });

  describe('levelFromExp: 역산 일관성', () => {
    const groups: GrowthGroup[] = [
      'fast',
      'medium_fast',
      'medium_slow',
      'slow',
      'erratic',
      'fluctuating',
    ];

    test.each(groups)('%s 그룹: 임계 EXP에서 정확히 다음 레벨', (g) => {
      for (let L = 1; L < POKEMON_LEVEL_MAX; L++) {
        const threshold = totalExpForLevel(L + 1, g);
        expect(levelFromExp(threshold, g)).toBe(L + 1);
        expect(levelFromExp(threshold - 1, g)).toBe(L);
      }
    });

    test.each(groups)('%s 그룹: 만렙 누적 이상은 모두 100', (g) => {
      const cap = totalExpForLevel(POKEMON_LEVEL_MAX, g);
      expect(levelFromExp(cap, g)).toBe(100);
      expect(levelFromExp(cap + 1_000_000, g)).toBe(100);
    });

    test('exp=0은 L1', () => {
      expect(levelFromExp(0, 'medium_fast')).toBe(1);
    });

    test('음수 exp는 L1로 안전 처리', () => {
      expect(levelFromExp(-100, 'fast')).toBe(1);
    });
  });

  describe('expToNextLevel', () => {
    test('레벨업 직후(누적 EXP가 정확히 L 도달치)에는 next-current가 다음 레벨 step', () => {
      const exp = totalExpForLevel(10, 'medium_fast'); // 1000
      const p = expToNextLevel(exp, 'medium_fast');
      expect(p.current).toBe(1000);
      expect(p.next).toBe(totalExpForLevel(11, 'medium_fast')); // 1331
      expect(p.remaining).toBe(p.next - exp);
    });

    test('만렙은 remaining=0, next=current', () => {
      const cap = totalExpForLevel(100, 'slow');
      const p = expToNextLevel(cap, 'slow');
      expect(p.current).toBe(cap);
      expect(p.next).toBe(cap);
      expect(p.remaining).toBe(0);
    });

    test('만렙 초과 EXP도 remaining=0', () => {
      const cap = totalExpForLevel(100, 'erratic');
      const p = expToNextLevel(cap + 9999, 'erratic');
      expect(p.remaining).toBe(0);
    });
  });

  describe('calcCaptureExp: Gen 5+ 스케일링 공식', () => {
    test('동레벨(L=Lp) scale=1, 단독 파티', () => {
      // floor((100 * 10) / 5 * 1 + 1) = 201
      expect(calcCaptureExp(100, 10, 1, 10)).toBe(201);
    });

    test('받는 포켓몬이 야생보다 높을수록 EXP 감소', () => {
      const same = calcCaptureExp(100, 10, 1, 10);
      const over = calcCaptureExp(100, 10, 1, 50);
      expect(over).toBeLessThan(same);
    });

    test('받는 포켓몬이 야생보다 낮을수록 EXP 증가', () => {
      const same = calcCaptureExp(100, 50, 1, 50);
      const under = calcCaptureExp(100, 50, 1, 10);
      expect(under).toBeGreaterThan(same);
    });

    test('파티 수가 늘면 1마리당 EXP 감소(분할)', () => {
      const solo = calcCaptureExp(100, 30, 1, 30);
      const full = calcCaptureExp(100, 30, 6, 30);
      expect(full).toBeLessThan(solo);
      // s=6은 s=1의 약 1/6
      expect(full * 6).toBeLessThanOrEqual(solo + 6);
    });

    test('participants<1 안전 처리(s=1로 취급)', () => {
      expect(calcCaptureExp(100, 10, 0, 10)).toBe(calcCaptureExp(100, 10, 1, 10));
      expect(calcCaptureExp(100, 10, -3, 10)).toBe(calcCaptureExp(100, 10, 1, 10));
    });

    test('baseExp<=0 또는 wildLevel<=0이면 0', () => {
      expect(calcCaptureExp(0, 50, 1, 10)).toBe(0);
      expect(calcCaptureExp(100, 0, 1, 10)).toBe(0);
    });
  });

  describe('EXP 사탕 상수', () => {
    test('5종 모두 정의', () => {
      expect(EXP_CANDY_VALUE['experience-candy-xs']).toBe(100);
      expect(EXP_CANDY_VALUE['experience-candy-s']).toBe(800);
      expect(EXP_CANDY_VALUE['experience-candy-m']).toBe(3_000);
      expect(EXP_CANDY_VALUE['experience-candy-l']).toBe(10_000);
      expect(EXP_CANDY_VALUE['experience-candy-xl']).toBe(30_000);
    });

    test('isExpCandyId 판별', () => {
      expect(isExpCandyId('experience-candy-m')).toBe(true);
      expect(isExpCandyId('fire-candy')).toBe(false);
      expect(isExpCandyId('safari-ball')).toBe(false);
    });
  });
});

import { pickExpCandyDrop } from '../exp-candy-drop';

describe('pickExpCandyDrop', () => {
  test('common: 저레벨 XS, 고레벨 S', () => {
    expect(pickExpCandyDrop('common', 1).itemId).toBe('experience-candy-xs');
    expect(pickExpCandyDrop('common', 30).itemId).toBe('experience-candy-xs');
    expect(pickExpCandyDrop('common', 31).itemId).toBe('experience-candy-s');
    expect(pickExpCandyDrop('common', 100).itemId).toBe('experience-candy-s');
  });

  test('rare: 저레벨 S, 고레벨 M', () => {
    expect(pickExpCandyDrop('rare', 30).itemId).toBe('experience-candy-s');
    expect(pickExpCandyDrop('rare', 31).itemId).toBe('experience-candy-m');
  });

  test('epic: 저레벨 M, 고레벨 L', () => {
    expect(pickExpCandyDrop('epic', 50).itemId).toBe('experience-candy-m');
    expect(pickExpCandyDrop('epic', 51).itemId).toBe('experience-candy-l');
  });

  test('legendary: 저레벨 L, 고레벨 XL', () => {
    expect(pickExpCandyDrop('legendary', 50).itemId).toBe('experience-candy-l');
    expect(pickExpCandyDrop('legendary', 51).itemId).toBe('experience-candy-xl');
  });

  test('수량은 항상 1', () => {
    const tiers = ['common', 'rare', 'epic', 'legendary'] as const;
    for (const t of tiers) {
      for (const L of [1, 30, 50, 100]) {
        expect(pickExpCandyDrop(t, L).quantity).toBe(1);
      }
    }
  });
});

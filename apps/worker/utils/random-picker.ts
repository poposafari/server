export class RandomPicker {
  static pick<T>(items: T[], getRate: (item: T) => number): T | null {
    if (items.length === 0) return null;

    const totalRate = items.reduce((sum, item) => sum + getRate(item), 0);
    if (totalRate <= 0) return null;

    let randomPoint = Math.random() * totalRate;

    for (const item of items) {
      const rate = getRate(item);
      if (randomPoint < rate) {
        return item;
      }
      randomPoint -= rate;
    }

    return items[items.length - 1];
  }

  static checkProbability(oneIn: number): boolean {
    return Math.random() < 1 / oneIn;
  }
}

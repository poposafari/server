declare module 'seedrandom' {
  /**
   * 시드 기반 의사 난수 생성기.
   * @param seed - 같은 시드면 항상 같은 [0, 1) 시퀀스 반환
   * @returns [0, 1) 구간의 난수를 반환하는 함수
   */
  function seedrandom(seed?: string, options?: { state?: boolean }): () => number;
  export = seedrandom;
}

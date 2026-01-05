import { RedisStore, RedisKeys } from '@poposerver/shared';

export type TimePhase = 'dawn' | 'day' | 'dusk' | 'night';

export class TimeService {
  // 실제 24시간(86400초) = 게임 6시간(21600초) => 4배속
  private readonly TIME_SCALE = 4;
  private readonly ONE_GAME_DAY_MS = (24 * 60 * 60 * 1000) / 4; // 실제 시간 기준 6시간

  public getCurrentTimePhase(): TimePhase {
    // 현재 시간을 게임 사이클로 변환
    const now = Date.now();
    const cyclePos = (now * this.TIME_SCALE) % (24 * 60 * 60 * 1000); // 0 ~ 24시간(ms)

    // 시간대 구분 (예시: 0~6시:새벽, 6~18시:낮, 18~20시:해질녘, 20~24시:밤)
    const hour = cyclePos / (60 * 60 * 1000);

    if (hour >= 6 && hour < 18) return 'day';
    if (hour >= 18 && hour < 20) return 'dusk';
    if (hour >= 20 || hour < 5) return 'night';
    return 'dawn';
  }

  /**
   * 1분마다 호출되어 시간을 Redis에 동기화하고 변경 시 이벤트 발행
   */
  public async syncGlobalTime(): Promise<void> {
    const phase = this.getCurrentTimePhase();

    await RedisStore.setJson(RedisKeys.globalTime, {
      phase,
      updatedAt: Date.now(),
      gameSpeed: this.TIME_SCALE,
    });

    // TODO : 시간이 바뀔 때마다 Pub/Sub으로 알림
  }
}

export const TimeManager = new TimeService();

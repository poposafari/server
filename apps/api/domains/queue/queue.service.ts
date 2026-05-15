import {
  clearUserStateSocketId,
  createConnToken,
  getQueuePosition,
  getUserState,
  isActivePlayer,
  publishSocketKick,
  removeFromQueue,
  setConnReservedGrace,
  touchQueueHeartbeat,
} from '@poposerver/lib/redis';

export type QueueStatusResult =
  | { ready: true; token: string }
  | { ready: false; position: number | null };

export class QueueService {
  /**
   * 클라이언트 QueuePhase 3초 폴링 진입점.
   *   - active:players 보유 → janitor promote 통과. 새 token 발급 + grace SETEX.
   *   - 큐 보유 → position + lastSeen heartbeat 갱신.
   *   - 둘 다 아님 → 큐에서 제거된 상태(stale 등). position: null.
   */
  async status(authId: string): Promise<QueueStatusResult> {
    if (await isActivePlayer(authId)) {
      const token = await this.issueConnTokenForPromoted(authId);
      await setConnReservedGrace(authId);
      return { ready: true, token };
    }

    const position = await getQueuePosition(authId);
    if (position === null) {
      return { ready: false, position: null };
    }

    await touchQueueHeartbeat(authId);
    return { ready: false, position };
  }

  /** 큐 입장 취소. 두 ZSET에서 멱등 제거. */
  async cancel(authId: string): Promise<void> {
    await removeFromQueue([authId]);
  }

  /**
   * promote된 사용자에게 토큰을 발급한다. 기존 소켓이 살아있다면 (재로그인 경로)
   * 마찬가지로 kick 신호를 publish해 정리한다.
   */
  private async issueConnTokenForPromoted(authId: string): Promise<string> {
    const existingState = await getUserState(authId);
    if (existingState && existingState.socketId) {
      const oldSocketId = existingState.socketId;
      await clearUserStateSocketId(authId);
      await publishSocketKick(authId, oldSocketId);
    }
    return createConnToken(authId);
  }
}

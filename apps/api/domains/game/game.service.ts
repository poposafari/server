import {
  clearUserStateSocketId,
  createConnToken,
  getActivePlayerCount,
  getUserState,
  isActivePlayer,
  publishSocketKick,
  setConnReservedGrace,
  tryAcquireSlot,
} from '@poposerver/lib/redis';
import { envConfig } from '@poposerver/lib/utils/env';

const ONLINE_COUNT_CACHE_TTL_MS = 5_000;
let onlineCache: { count: number; at: number } = { count: 0, at: 0 };

export type ConnectResult = { ready: true; token: string } | { ready: false };

export class GameService {
  async issueConnToken(authId: string): Promise<string> {
    const existingState = await getUserState(authId);
    if (existingState) {
      const oldSocketId = existingState.socketId || undefined;
      // socketId를 먼저 비워서 킥된 소켓의 disconnect 핸들러가
      // user:state를 삭제하지 않도록 한다.
      await clearUserStateSocketId(authId);
      await publishSocketKick(authId, oldSocketId);
    }

    const token = await createConnToken(authId);
    return token;
  }

  async connect(authId: string): Promise<ConnectResult> {
    if (await isActivePlayer(authId)) {
      const token = await this.issueConnToken(authId);
      await setConnReservedGrace(authId);
      return { ready: true, token };
    }

    const acquired = await tryAcquireSlot(authId, envConfig.SLOT_CAPACITY);
    if (!acquired) {
      return { ready: false };
    }

    const token = await this.issueConnToken(authId);
    await setConnReservedGrace(authId);
    return { ready: true, token };
  }

  async getOnlineCount(): Promise<number> {
    const now = Date.now();
    if (now - onlineCache.at < ONLINE_COUNT_CACHE_TTL_MS) {
      return onlineCache.count;
    }
    const count = await getActivePlayerCount();
    onlineCache = { count, at: now };
    return count;
  }
}

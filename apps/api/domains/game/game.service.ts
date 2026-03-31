import {
  getUserState,
  publishSocketKick,
  createConnToken,
  clearUserStateSocketId,
} from '@poposerver/lib/redis';

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
}

import { db } from '@poposerver/lib/db';
import { userTownMap } from '@poposerver/lib/schema';
import { eq } from 'drizzle-orm';

export class TownMapRepository {
  async findAllByAccountId(accountId: number) {
    return db
      .select({
        mapId: userTownMap.mapId,
        visitedAt: userTownMap.visitedAt,
      })
      .from(userTownMap)
      .where(eq(userTownMap.accountId, accountId))
      .orderBy(userTownMap.mapId);
  }
}

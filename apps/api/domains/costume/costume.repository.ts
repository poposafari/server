import { db } from '@poposerver/lib/db';
import { userCostume } from '@poposerver/lib/schema';
import { eq } from 'drizzle-orm';

export class CostumeRepository {
  async findAllByAccountId(accountId: number) {
    return db
      .select({
        costumeId: userCostume.costumeId,
        isEquipped: userCostume.isEquipped,
      })
      .from(userCostume)
      .where(eq(userCostume.accountId, accountId));
  }
}

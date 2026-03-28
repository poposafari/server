import { db } from '@poposerver/lib/db';
import { userItem } from '@poposerver/lib/schema';
import { eq, and, isNull } from 'drizzle-orm';

export class ItemRepository {
  async findBagByAccountId(accountId: number) {
    return db
      .select({
        itemId: userItem.itemId,
        quantity: userItem.quantity,
        slotNumber: userItem.slotNumber,
      })
      .from(userItem)
      .where(
        and(eq(userItem.accountId, accountId), isNull(userItem.slotNumber)),
      );
  }
}

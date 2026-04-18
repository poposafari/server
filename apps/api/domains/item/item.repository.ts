import { db } from '@poposerver/lib/db';
import { userItem } from '@poposerver/lib/schema';
import { eq } from 'drizzle-orm';

export class ItemRepository {
  async findBagByAccountId(accountId: number) {
    return db
      .select({
        itemId: userItem.itemId,
        quantity: userItem.quantity,
        register: userItem.register,
      })
      .from(userItem)
      .where(eq(userItem.accountId, accountId));
  }
}

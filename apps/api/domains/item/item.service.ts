import { eq, and, sql } from 'drizzle-orm';
import { db } from '@poposerver/lib/db';
import { user, userItem } from '@poposerver/lib/schema';
import { MasterData } from '@poposerver/lib/utils/master-data';
import { AppError } from '@poposerver/lib/utils/error';
import { AppErrorCode } from '@poposerver/lib/types';
import { ItemRepository } from './item.repository';

export class ItemService {
  constructor(private readonly repo: ItemRepository) {}

  async getBag(authId: string) {
    return this.repo.findBagByAccountId(Number(authId));
  }

  async sell(authId: string, body: { item: string; quantity: number }) {
    const accountId = Number(authId);

    // 1. 마스터 데이터 검증
    const itemData = MasterData.getItem(body.item);
    if (!itemData) {
      throw new AppError('Item not found', 404, AppErrorCode.ITEM_NOT_FOUND);
    }

    // 2. 판매 가능 여부
    if (!itemData.sellable) {
      throw new AppError('Item is not sellable', 400, AppErrorCode.ITEM_NOT_SELLABLE);
    }

    // 3. 소지 수량 확인
    const [ownedItem] = await db
      .select({ quantity: userItem.quantity })
      .from(userItem)
      .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, body.item)));

    if (!ownedItem || ownedItem.quantity < body.quantity) {
      throw new AppError('Insufficient item quantity', 400, AppErrorCode.ITEM_INSUFFICIENT_QUANTITY);
    }

    // 4. 판매 금액 계산
    const totalGain = itemData.sell * body.quantity;

    // 5. 트랜잭션: 아이템 차감 + money 증가
    const result = await db.transaction(async (tx) => {
      const remaining = ownedItem.quantity - body.quantity;

      if (remaining === 0) {
        await tx
          .delete(userItem)
          .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, body.item)));
      } else {
        await tx
          .update(userItem)
          .set({ quantity: sql`${userItem.quantity} - ${body.quantity}` })
          .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, body.item)));
      }

      const [updatedUser] = await tx
        .update(user)
        .set({ money: sql`${user.money} + ${totalGain}` })
        .where(eq(user.accountId, accountId))
        .returning({ money: user.money });

      return { money: updatedUser.money };
    });

    return result;
  }
}

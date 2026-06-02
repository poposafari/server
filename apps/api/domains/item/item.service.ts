import { eq, and, sql } from 'drizzle-orm';
import { db } from '@poposerver/lib/db';
import { user, userItem, userPokemon } from '@poposerver/lib/schema';
import { MasterData } from '@poposerver/lib/utils/master-data';
import { AppError } from '@poposerver/lib/utils/error';
import { AppErrorCode, AuditAction } from '@poposerver/lib/types';
import { auditTx } from '@poposerver/lib/utils/audit';
import { ItemRepository } from './item.repository';

const MAX_ITEM_QUANTITY = 9_999_999;
const MAX_USER_MONEY = 999_999_999;

export class ItemService {
  constructor(private readonly repo: ItemRepository) {}

  async getBag(authId: string) {
    return this.repo.findBagByAccountId(Number(authId));
  }

  async buy(authId: string, body: { item: string; quantity: number }, ip?: string) {
    const accountId = Number(authId);

    const itemData = MasterData.getItem(body.item);
    if (!itemData) {
      throw new AppError('Item not found', 404, AppErrorCode.ITEM_NOT_FOUND);
    }

    if (!itemData.purchasable) {
      throw new AppError('Item is not purchasable', 400, AppErrorCode.ITEM_NOT_PURCHASABLE);
    }

    if (body.item === 'bicycle') {
      const [ownedBicycle] = await db
        .select({ quantity: userItem.quantity })
        .from(userItem)
        .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, 'bicycle')));
      if (ownedBicycle && ownedBicycle.quantity > 0) {
        throw new AppError('Bicycle already owned', 400, AppErrorCode.ITEM_ALREADY_OWNED);
      }
    }

    const totalCost = itemData.buy * body.quantity;

    const [userData] = await db
      .select({ money: user.money })
      .from(user)
      .where(eq(user.accountId, accountId));

    if (!userData || userData.money < totalCost) {
      throw new AppError('Insufficient money', 400, AppErrorCode.INSUFFICIENT_MONEY);
    }

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ quantity: userItem.quantity })
        .from(userItem)
        .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, body.item)));
      const newQty = (existing?.quantity ?? 0) + body.quantity;
      if (newQty > MAX_ITEM_QUANTITY) {
        throw new AppError(
          'Item quantity limit exceeded',
          400,
          AppErrorCode.ITEM_QUANTITY_LIMIT_EXCEEDED,
        );
      }

      const [updatedUser] = await tx
        .update(user)
        .set({ money: sql`${user.money} - ${totalCost}` })
        .where(eq(user.accountId, accountId))
        .returning({ money: user.money });

      await tx
        .insert(userItem)
        .values({ accountId, itemId: body.item, quantity: body.quantity })
        .onConflictDoUpdate({
          target: [userItem.accountId, userItem.itemId],
          set: { quantity: sql`${userItem.quantity} + ${body.quantity}` },
        });

      const [item] = await tx
        .select({
          itemId: userItem.itemId,
          quantity: userItem.quantity,
          register: userItem.register,
        })
        .from(userItem)
        .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, body.item)));

      await auditTx(tx, {
        accountId,
        action: AuditAction.ITEM_BUY,
        detail: { item: body.item, quantity: body.quantity, totalCost, money: updatedUser.money },
        ip: ip ?? null,
        source: 'api',
      });

      return { money: updatedUser.money, item };
    });

    return result;
  }

  async sell(authId: string, body: { item: string; quantity: number }, ip?: string) {
    const accountId = Number(authId);

    const itemData = MasterData.getItem(body.item);
    if (!itemData) {
      throw new AppError('Item not found', 404, AppErrorCode.ITEM_NOT_FOUND);
    }

    console.log(body.item + itemData.sellable);

    if (!itemData.sellable) {
      throw new AppError('Item is not sellable', 400, AppErrorCode.ITEM_NOT_SELLABLE);
    }

    const [ownedItem] = await db
      .select({ quantity: userItem.quantity })
      .from(userItem)
      .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, body.item)));

    if (!ownedItem || ownedItem.quantity < body.quantity) {
      throw new AppError(
        'Insufficient item quantity',
        400,
        AppErrorCode.ITEM_INSUFFICIENT_QUANTITY,
      );
    }

    const totalGain = itemData.sell * body.quantity;

    const [currentUser] = await db
      .select({ money: user.money })
      .from(user)
      .where(eq(user.accountId, accountId));

    if (currentUser && currentUser.money + totalGain > MAX_USER_MONEY) {
      throw new AppError('Money limit exceeded', 400, AppErrorCode.MONEY_LIMIT_EXCEEDED);
    }

    const result = await db.transaction(async (tx) => {
      const [txUser] = await tx
        .select({ money: user.money })
        .from(user)
        .where(eq(user.accountId, accountId));
      if (txUser && txUser.money + totalGain > MAX_USER_MONEY) {
        throw new AppError('Money limit exceeded', 400, AppErrorCode.MONEY_LIMIT_EXCEEDED);
      }

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

      await auditTx(tx, {
        accountId,
        action: AuditAction.ITEM_SELL,
        detail: { item: body.item, quantity: body.quantity, totalGain, money: updatedUser.money },
        ip: ip ?? null,
        source: 'api',
      });

      return { money: updatedUser.money };
    });

    return result;
  }

  async giveHold(authId: string, body: { userPokemonId: number; heldItem: string }) {
    const accountId = Number(authId);

    const itemData = MasterData.getItem(body.heldItem);
    if (!itemData) {
      throw new AppError('Item not found', 404, AppErrorCode.ITEM_NOT_FOUND);
    }
    if (itemData.category === 'key') {
      throw new AppError('Item is not holdable', 400, AppErrorCode.ITEM_NOT_HOLDABLE);
    }

    return db.transaction(async (tx) => {
      const [pkm] = await tx
        .select({ id: userPokemon.id, heldItemId: userPokemon.heldItemId })
        .from(userPokemon)
        .where(and(eq(userPokemon.id, body.userPokemonId), eq(userPokemon.accountId, accountId)));
      if (!pkm) {
        throw new AppError('Pokemon not owned', 403, AppErrorCode.POKEMON_NOT_OWNED);
      }

      const [owned] = await tx
        .select({ quantity: userItem.quantity })
        .from(userItem)
        .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, body.heldItem)));
      if (!owned || owned.quantity < 1) {
        throw new AppError('Item not owned', 400, AppErrorCode.ITEM_NOT_OWNED);
      }

      // 1) 새 heldItem -1 (0이면 삭제)
      if (owned.quantity === 1) {
        await tx
          .delete(userItem)
          .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, body.heldItem)));
      } else {
        await tx
          .update(userItem)
          .set({ quantity: sql`${userItem.quantity} - 1` })
          .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, body.heldItem)));
      }

      // 2) 기존 heldItem 반환
      if (pkm.heldItemId) {
        await tx
          .insert(userItem)
          .values({ accountId, itemId: pkm.heldItemId, quantity: 1, register: false })
          .onConflictDoUpdate({
            target: [userItem.accountId, userItem.itemId],
            set: { quantity: sql`${userItem.quantity} + 1` },
          });
      }

      // 3) heldItem 덮어쓰기
      await tx
        .update(userPokemon)
        .set({ heldItemId: body.heldItem })
        .where(eq(userPokemon.id, body.userPokemonId));

      return {
        pokemonId: body.userPokemonId,
        heldItem: body.heldItem,
        previousHeld: pkm.heldItemId,
      };
    });
  }

  async takeHold(authId: string, body: { id: number }) {
    const accountId = Number(authId);

    return db.transaction(async (tx) => {
      const [pkm] = await tx
        .select({ id: userPokemon.id, heldItemId: userPokemon.heldItemId })
        .from(userPokemon)
        .where(and(eq(userPokemon.id, body.id), eq(userPokemon.accountId, accountId)));
      if (!pkm) {
        throw new AppError('Pokemon not owned', 403, AppErrorCode.POKEMON_NOT_OWNED);
      }
      if (!pkm.heldItemId) {
        throw new AppError('Pokemon has no held item', 400, AppErrorCode.POKEMON_NO_HELD_ITEM);
      }

      const returnedItemId = pkm.heldItemId;

      await tx.update(userPokemon).set({ heldItemId: null }).where(eq(userPokemon.id, body.id));

      await tx
        .insert(userItem)
        .values({ accountId, itemId: returnedItemId, quantity: 1, register: false })
        .onConflictDoUpdate({
          target: [userItem.accountId, userItem.itemId],
          set: { quantity: sql`${userItem.quantity} + 1` },
        });

      return {
        pokemonId: body.id,
        returnedItem: returnedItemId,
      };
    });
  }

  async register(authId: string, body: { itemId: string }) {
    const accountId = Number(authId);

    const itemData = MasterData.getItem(body.itemId);
    if (!itemData) {
      throw new AppError('Item not found', 404, AppErrorCode.ITEM_NOT_FOUND);
    }
    if (itemData.category !== 'key') {
      throw new AppError('Item is not registerable', 400, AppErrorCode.ITEM_NOT_REGISTERABLE);
    }

    const updated = await db
      .update(userItem)
      .set({ register: true })
      .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, body.itemId)))
      .returning({
        itemId: userItem.itemId,
        quantity: userItem.quantity,
        register: userItem.register,
      });
    if (updated.length === 0) {
      throw new AppError('Item not owned', 400, AppErrorCode.ITEM_NOT_OWNED);
    }
    return updated[0];
  }

  async unregister(authId: string, body: { itemId: string }) {
    const accountId = Number(authId);

    const itemData = MasterData.getItem(body.itemId);
    if (!itemData) {
      throw new AppError('Item not found', 404, AppErrorCode.ITEM_NOT_FOUND);
    }
    if (itemData.category !== 'key') {
      throw new AppError('Item is not registerable', 400, AppErrorCode.ITEM_NOT_REGISTERABLE);
    }

    const updated = await db
      .update(userItem)
      .set({ register: false })
      .where(and(eq(userItem.accountId, accountId), eq(userItem.itemId, body.itemId)))
      .returning({
        itemId: userItem.itemId,
        quantity: userItem.quantity,
        register: userItem.register,
      });
    if (updated.length === 0) {
      throw new AppError('Item not owned', 400, AppErrorCode.ITEM_NOT_OWNED);
    }
    return updated[0];
  }
}

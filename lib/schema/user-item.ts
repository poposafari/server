import { pgTable, integer, smallint, primaryKey, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { account } from './account';

export const userItem = pgTable(
  'user_item',
  {
    accountId: integer('account_id')
      .notNull()
      .references(() => account.id),
    itemId: integer('item_id').notNull(),
    quantity: integer('quantity').notNull().default(1),
    slotNumber: smallint('slot_number'),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.itemId] }),
    check('ck_user_item_quantity', sql`${table.quantity} >= 0`),
  ],
);

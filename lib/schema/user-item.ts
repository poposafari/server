import { pgTable, integer, boolean, primaryKey, check, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { account } from './account';

export const userItem = pgTable(
  'user_item',
  {
    accountId: integer('account_id')
      .notNull()
      .references(() => account.id),
    itemId: varchar('item_id', { length: 64 }).notNull(),
    quantity: integer('quantity').notNull().default(1),
    register: boolean('register').notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.itemId] }),
    check('ck_user_item_quantity', sql`${table.quantity} >= 0`),
  ],
);

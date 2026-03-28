import { pgTable, integer, varchar, boolean, primaryKey } from 'drizzle-orm/pg-core';
import { account } from './account';

export const userCostume = pgTable(
  'user_costume',
  {
    accountId: integer('account_id')
      .notNull()
      .references(() => account.id),
    costumeId: varchar('costume_id', { length: 20 }).notNull(),
    isEquipped: boolean('is_equipped').notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.costumeId] })],
);

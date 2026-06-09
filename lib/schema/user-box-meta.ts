import { pgTable, integer, smallint, varchar, primaryKey } from 'drizzle-orm/pg-core';
import { account } from './account';

export const userBoxMeta = pgTable(
  'user_box_meta',
  {
    accountId: integer('account_id')
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    boxNumber: smallint('box_number').notNull(),
    wallpaper: smallint('wallpaper').notNull().default(0),
    name: varchar('name', { length: 20 }).notNull().default(''),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.boxNumber] })],
);

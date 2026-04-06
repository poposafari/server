import { pgTable, integer, char, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { account } from './account';

export const userTownMap = pgTable(
  'user_town_map',
  {
    accountId: integer('account_id')
      .notNull()
      .references(() => account.id),
    mapId: char('map_id', { length: 4 }).notNull(),
    visitedAt: timestamp('visited_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.mapId] })],
);

import { pgTable, integer, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { account } from './account';

export const userTownMap = pgTable(
  'user_town_map',
  {
    accountId: integer('account_id')
      .notNull()
      .references(() => account.id),
    mapId: integer('map_id').notNull(),
    visitedAt: timestamp('visited_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.mapId] })],
);

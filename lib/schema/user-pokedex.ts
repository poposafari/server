import { pgTable, integer, varchar, timestamp, primaryKey, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { account } from './account';

export const userPokedex = pgTable(
  'user_pokedex',
  {
    accountId: integer('account_id')
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    pokedexId: varchar('pokedex_id', { length: 10 }).notNull(),
    caughtCount: integer('caught_count').notNull().default(1),
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.pokedexId] }),
    check('ck_user_pokedex_caught_count', sql`${table.caughtCount} >= 0`),
  ],
);

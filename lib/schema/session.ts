import { pgTable, uuid, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { account } from './account';

export const session = pgTable(
  'session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: integer('account_id')
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('idx_session_expires_at').on(table.expiresAt)],
);

import { pgTable, serial, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const account = pgTable(
  'account',
  {
    id: serial('id').primaryKey(),
    provider: varchar('provider', { length: 10 }).notNull(),
    providerId: varchar('provider_id', { length: 128 }).notNull(),
    password: varchar('password', { length: 72 }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('uq_account_provider').on(table.provider, table.providerId)],
);

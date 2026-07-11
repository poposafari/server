import { pgTable, uuid, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { account } from './account';

// 세션 — durable. 배포/재시작에도 로그인 유지(재로그인 없음). 구 Redis session:{uuid}.
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

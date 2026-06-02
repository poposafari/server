import {
  pgTable,
  bigserial,
  integer,
  smallint,
  varchar,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    accountId: integer('account_id'),
    action: varchar('action', { length: 64 }).notNull(),
    status: smallint('status'), // HTTP 상태/결과 : 성공(2xx)/실패(4xx)
    detail: jsonb('detail'),
    ip: varchar('ip', { length: 45 }), // IPv6 최대 길이 : 탈취 포렌식
    userAgent: varchar('user_agent', { length: 512 }), // 기기
    source: varchar('source', { length: 16 }).notNull(), // 'api' | 'socket'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_audit_account_created').on(table.accountId, table.createdAt),
    index('idx_audit_created').on(table.createdAt),
  ],
);

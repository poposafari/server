import { pgTable, integer, varchar, char, boolean, smallint, timestamp, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { account } from './account';

export const user = pgTable(
  'user',
  {
    accountId: integer('account_id')
      .primaryKey()
      .references(() => account.id),
    nickname: varchar('nickname', { length: 14 }).notNull().unique(),
    money: integer('money').notNull().default(0),
    playtime: integer('playtime').notNull().default(0),
    hasStarter: boolean('has_starter').notNull().default(true),
    level: smallint('level').notNull().default(1),
    exp: integer('exp').notNull().default(0),
    gender: smallint('gender').notNull(),
    lastMapId: char('last_map_id', { length: 4 }).notNull(),
    lastX: integer('last_x').notNull(),
    lastY: integer('last_y').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('ck_user_money', sql`${table.money} >= 0`),
    check('ck_user_level', sql`${table.level} >= 1 AND ${table.level} <= 50`),
    check('ck_user_exp', sql`${table.exp} >= 0`),
  ],
);

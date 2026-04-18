import {
  pgTable,
  serial,
  integer,
  smallint,
  boolean,
  varchar,
  jsonb,
  timestamp,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { account } from './account';

export const userPokemon = pgTable(
  'user_pokemon',
  {
    id: serial('id').primaryKey(),
    accountId: integer('account_id')
      .notNull()
      .references(() => account.id),
    pokedexId: varchar('pokedex_id', { length: 20 }).notNull(),
    level: smallint('level').notNull().default(1),
    friendship: smallint('friendship').notNull().default(0),
    gender: smallint('gender').notNull(),
    isShiny: boolean('is_shiny').notNull().default(false),
    nickname: varchar('nickname', { length: 50 }),
    abilityId: varchar('ability_id', { length: 50 }).notNull(),
    natureId: varchar('nature_id', { length: 50 }).notNull(),
    skills: jsonb('skills').notNull().default([]),
    heldItemId: varchar('held_item_id', { length: 64 }),
    boxNumber: smallint('box_number'),
    gridNumber: smallint('grid_number'),
    partySlot: smallint('party_slot'),
    ballId: integer('ball_id').notNull(),
    caughtLocation: varchar('caught_location', { length: 4 }).notNull(),
    caughtAt: timestamp('caught_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_user_pokemon_box_grid').on(table.accountId, table.boxNumber, table.gridNumber),
    check(
      'ck_user_pokemon_friendship',
      sql`${table.friendship} >= 0 AND ${table.friendship} <= 255`,
    ),
  ],
);

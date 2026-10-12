import { bigint, integer, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const splitType = pgEnum('split_type', ['equal', 'exact', 'shares']);

export const groups = pgTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const members = pgTable('members', {
  id: serial('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
});

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  payerId: integer('payer_id').notNull().references(() => members.id),
  splitType: splitType('split_type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const expenseSplits = pgTable('expense_splits', {
  id: serial('id').primaryKey(),
  expenseId: integer('expense_id').notNull().references(() => expenses.id, { onDelete: 'cascade' }),
  memberId: integer('member_id').notNull().references(() => members.id),
  value: bigint('value', { mode: 'number' }).notNull(),
});

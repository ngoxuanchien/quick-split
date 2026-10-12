import { asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '.';
import { expenses, expenseSplits, groups, members } from './schema';

export async function getGroup(id: string) {
  const [group] = await db.select().from(groups).where(eq(groups.id, id));
  if (!group) return null;
  const mems = await db.select().from(members).where(eq(members.groupId, id)).orderBy(asc(members.id));
  const exps = await db
    .select()
    .from(expenses)
    .where(eq(expenses.groupId, id))
    .orderBy(desc(expenses.createdAt), desc(expenses.id));
  const splits = exps.length
    ? await db
        .select()
        .from(expenseSplits)
        .where(inArray(expenseSplits.expenseId, exps.map((e) => e.id)))
        .orderBy(asc(expenseSplits.id))
    : [];
  return {
    group,
    members: mems,
    expenses: exps.map((e) => ({
      ...e,
      splits: splits.filter((s) => s.expenseId === e.id).map((s) => ({ memberId: s.memberId, value: s.value })),
    })),
  };
}

export type GroupData = NonNullable<Awaited<ReturnType<typeof getGroup>>>;

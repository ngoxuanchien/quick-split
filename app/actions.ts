'use server';

import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { getGroup } from '@/db/queries';
import { expenses, expenseSplits, groups, members } from '@/db/schema';
import { isOwed } from '@/lib/split';
import { groupPath } from '@/lib/routes';
import { expenseInput, firstError, groupInput, MAX_MEMBERS, memberName, type ExpenseInput } from '@/lib/validation';

// input echoes submitted text so forms can refill it (React 19 resets forms after an action)
export type Result = { error: string; input?: Record<string, string> } | undefined;

const groupMembers = (groupId: string) =>
  db.select({ id: members.id, name: members.name }).from(members).where(eq(members.groupId, groupId));

export async function createGroup(_prev: Result, formData: FormData): Promise<Result> {
  const input = { name: String(formData.get('name') ?? ''), members: String(formData.get('members') ?? '') };
  const parsed = groupInput.safeParse({
    name: input.name,
    members: input.members
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
  });
  if (!parsed.success) return { error: firstError(parsed.error), input };
  const id = randomBytes(16).toString('base64url');
  await db.transaction(async (tx) => {
    await tx.insert(groups).values({ id, name: parsed.data.name });
    await tx.insert(members).values(parsed.data.members.map((name) => ({ groupId: id, name })));
  });
  redirect(groupPath(id));
}

export async function addMember(groupId: string, _prev: Result, formData: FormData): Promise<Result> {
  const input = { name: String(formData.get('name') ?? '') };
  const name = memberName.safeParse(input.name);
  if (!name.success) return { error: firstError(name.error), input };
  const existing = await groupMembers(groupId);
  if (existing.length >= MAX_MEMBERS) return { error: `Tối đa ${MAX_MEMBERS} thành viên`, input };
  if (existing.some((m) => m.name.toLowerCase() === name.data.toLowerCase())) return { error: 'Tên thành viên bị trùng', input };
  await db.insert(members).values({ groupId, name: name.data });
  revalidatePath(groupPath(groupId));
  return undefined;
}

export async function renameMember(groupId: string, memberId: number, _prev: Result, formData: FormData): Promise<Result> {
  const input = { name: String(formData.get('name') ?? '') };
  const name = memberName.safeParse(input.name);
  if (!name.success) return { error: firstError(name.error), input };
  const existing = await groupMembers(groupId);
  if (existing.some((m) => m.id !== memberId && m.name.toLowerCase() === name.data.toLowerCase())) {
    return { error: 'Tên thành viên bị trùng', input };
  }
  await db
    .update(members)
    .set({ name: name.data })
    .where(and(eq(members.id, memberId), eq(members.groupId, groupId)));
  revalidatePath(groupPath(groupId));
  return undefined;
}

export async function deleteMember(groupId: string, memberId: number): Promise<void> {
  // UI disables the button in these cases; this guards direct calls
  if ((await groupMembers(groupId)).length <= 2) return;
  const [paid] = await db.select({ id: expenses.id }).from(expenses).where(eq(expenses.payerId, memberId)).limit(1);
  const [split] = await db
    .select({ id: expenseSplits.id })
    .from(expenseSplits)
    .where(eq(expenseSplits.memberId, memberId))
    .limit(1);
  if (paid || split) return;
  await db.delete(members).where(and(eq(members.id, memberId), eq(members.groupId, groupId)));
  revalidatePath(groupPath(groupId));
}

async function writeExpense(groupId: string, expenseId: number | null, input: ExpenseInput): Promise<Result> {
  const parsed = expenseInput.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const e = parsed.data;
  const ids = new Set((await groupMembers(groupId)).map((m) => m.id));
  if (!ids.has(e.payerId) || e.splits.some((s) => !ids.has(s.memberId))) return { error: 'Thành viên không hợp lệ' };
  const values = { title: e.title, amount: e.amount, payerId: e.payerId, splitType: e.splitType };
  const found = await db.transaction(async (tx) => {
    let id: number;
    if (expenseId === null) {
      const [row] = await tx.insert(expenses).values({ ...values, groupId }).returning({ id: expenses.id });
      id = row.id;
    } else {
      const updated = await tx
        .update(expenses)
        .set(values)
        .where(and(eq(expenses.id, expenseId), eq(expenses.groupId, groupId)))
        .returning({ id: expenses.id });
      if (!updated.length) return false;
      id = expenseId;
      await tx.delete(expenseSplits).where(eq(expenseSplits.expenseId, id));
    }
    await tx.insert(expenseSplits).values(e.splits.map((s) => ({ expenseId: id, memberId: s.memberId, value: s.value })));
    return true;
  });
  if (!found) return { error: 'Không tìm thấy khoản chi' };
  revalidatePath(groupPath(groupId));
  return undefined;
}

export async function saveExpense(groupId: string, expenseId: number | null, input: ExpenseInput): Promise<Result> {
  const res = await writeExpense(groupId, expenseId, input);
  if (res) return res;
  redirect(groupPath(groupId));
}

export async function deleteExpense(groupId: string, expenseId: number): Promise<void> {
  await db.delete(expenses).where(and(eq(expenses.id, expenseId), eq(expenses.groupId, groupId)));
  revalidatePath(groupPath(groupId));
}

export async function recordPayment(groupId: string, from: number, to: number, amount: number): Promise<void> {
  // ignore stale/double submits: only record a transfer that is still owed
  // ponytail: check-then-insert is not atomic; two truly simultaneous requests can still both pass
  const data = await getGroup(groupId);
  if (!data || !isOwed(data.expenses, { from, to, amount })) redirect(groupPath(groupId, 'balances'));
  const res = await writeExpense(groupId, null, {
    title: 'Thanh toán',
    amount,
    payerId: from,
    splitType: 'exact',
    splits: [{ memberId: to, value: amount }],
  });
  if (res) throw new Error(res.error); // only reachable with tampered args
  redirect(groupPath(groupId, 'balances'));
}

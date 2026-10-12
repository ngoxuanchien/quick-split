'use server';

import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { getGroup } from '@/db/queries';
import { expenses, expenseSplits, groups, members } from '@/db/schema';
import { isLocale, LOCALE_COOKIE } from '@/lib/i18n';
import { getT } from '@/lib/i18n/server';
import { isOwed, PAYMENT_TITLE } from '@/lib/split';
import { groupPath } from '@/lib/routes';
import { expenseInput, firstError, groupInput, MAX_MEMBERS, memberAccount, memberName, type ExpenseInput } from '@/lib/validation';

// input echoes submitted text so forms can refill it (React 19 resets forms after an action)
export type Result = { error: string; input?: Record<string, string> } | undefined;

const groupMembers = (groupId: string) =>
  db.select({ id: members.id, name: members.name }).from(members).where(eq(members.groupId, groupId));

export async function setLocale(formData: FormData): Promise<void> {
  const locale = formData.get('locale');
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  revalidatePath('/', 'layout');
}

export async function createGroup(_prev: Result, formData: FormData): Promise<Result> {
  const input = { name: String(formData.get('name') ?? ''), members: String(formData.get('members') ?? '') };
  const parsed = groupInput.safeParse({
    name: input.name,
    members: input.members
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
  });
  if (!parsed.success) return { error: firstError(parsed.error, await getT()), input };
  const id = randomBytes(16).toString('base64url');
  await db.transaction(async (tx) => {
    await tx.insert(groups).values({ id, name: parsed.data.name });
    await tx.insert(members).values(parsed.data.members.map((name) => ({ groupId: id, name })));
  });
  redirect(groupPath(id));
}

export async function addMember(groupId: string, _prev: Result, formData: FormData): Promise<Result> {
  const input = { name: String(formData.get('name') ?? '') };
  const t = await getT();
  const name = memberName.safeParse(input.name);
  if (!name.success) return { error: firstError(name.error, t), input };
  const existing = await groupMembers(groupId);
  if (existing.length >= MAX_MEMBERS) return { error: t.errors.maxMembers, input };
  if (existing.some((m) => m.name.toLowerCase() === name.data.toLowerCase())) return { error: t.errors.duplicateMemberName, input };
  await db.insert(members).values({ groupId, name: name.data });
  revalidatePath(groupPath(groupId));
  return undefined;
}

export async function updateMember(groupId: string, memberId: number, _prev: Result, formData: FormData): Promise<Result> {
  const input = {
    name: String(formData.get('name') ?? ''),
    bankBin: String(formData.get('bankBin') ?? ''),
    accountNo: String(formData.get('accountNo') ?? ''),
  };
  const t = await getT();
  const name = memberName.safeParse(input.name);
  if (!name.success) return { error: firstError(name.error, t), input };
  const account = memberAccount.safeParse(input);
  if (!account.success) return { error: firstError(account.error, t), input };
  const existing = await groupMembers(groupId);
  if (existing.some((m) => m.id !== memberId && m.name.toLowerCase() === name.data.toLowerCase())) {
    return { error: t.errors.duplicateMemberName, input };
  }
  await db
    .update(members)
    .set({ name: name.data, ...account.data })
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
  const t = await getT();
  const parsed = expenseInput.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error, t) };
  const e = parsed.data;
  const ids = new Set((await groupMembers(groupId)).map((m) => m.id));
  if (!ids.has(e.payerId) || e.splits.some((s) => !ids.has(s.memberId))) return { error: t.errors.invalidMember };
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
  if (!found) return { error: t.errors.expenseNotFound };
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
    title: PAYMENT_TITLE,
    amount,
    payerId: from,
    splitType: 'exact',
    splits: [{ memberId: to, value: amount }],
  });
  if (res) throw new Error(res.error); // only reachable with tampered args
  redirect(groupPath(groupId, 'balances'));
}

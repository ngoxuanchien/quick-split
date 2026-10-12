'use server';

import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { expenses, expenseSplits, groups, members } from '@/db/schema';
import { firstError, groupInput, memberName } from '@/lib/validation';

export type Result = { error: string } | undefined;

const groupMembers = (groupId: string) =>
  db.select({ id: members.id, name: members.name }).from(members).where(eq(members.groupId, groupId));

export async function createGroup(_prev: Result, formData: FormData): Promise<Result> {
  const parsed = groupInput.safeParse({
    name: String(formData.get('name') ?? ''),
    members: String(formData.get('members') ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const id = randomBytes(16).toString('base64url');
  await db.transaction(async (tx) => {
    await tx.insert(groups).values({ id, name: parsed.data.name });
    await tx.insert(members).values(parsed.data.members.map((name) => ({ groupId: id, name })));
  });
  redirect(`/g/${id}`);
}

export async function addMember(groupId: string, formData: FormData): Promise<void> {
  const name = memberName.safeParse(String(formData.get('name') ?? ''));
  if (!name.success) return;
  const existing = await groupMembers(groupId);
  if (existing.some((m) => m.name.toLowerCase() === name.data.toLowerCase())) return;
  await db.insert(members).values({ groupId, name: name.data });
  revalidatePath(`/g/${groupId}`);
}

export async function renameMember(groupId: string, memberId: number, formData: FormData): Promise<void> {
  const name = memberName.safeParse(String(formData.get('name') ?? ''));
  if (!name.success) return;
  const existing = await groupMembers(groupId);
  if (existing.some((m) => m.id !== memberId && m.name.toLowerCase() === name.data.toLowerCase())) return;
  await db
    .update(members)
    .set({ name: name.data })
    .where(and(eq(members.id, memberId), eq(members.groupId, groupId)));
  revalidatePath(`/g/${groupId}`);
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
  revalidatePath(`/g/${groupId}`);
}

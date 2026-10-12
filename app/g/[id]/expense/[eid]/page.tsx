import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGroup } from '@/db/queries';
import { getT } from '@/lib/i18n/server';
import { groupPath } from '@/lib/routes';
import { ExpenseForm } from '../expense-form';

// always reads fresh DB data; blocking render is intended
export const instant = false;

export default async function EditExpensePage({ params }: { params: Promise<{ id: string; eid: string }> }) {
  const { id, eid } = await params;
  const data = await getGroup(id);
  const expense = data?.expenses.find((e) => e.id === Number(eid));
  if (!data || !expense) notFound();
  const t = await getT();
  return (
    <div className="space-y-4 px-4 py-5 lg:mx-auto lg:max-w-2xl lg:py-10">
      <Link href={groupPath(id)} className="link text-sm">
        ← {data.group.name}
      </Link>
      <h1 className="text-xl font-bold">{t.expense.editTitle}</h1>
      <ExpenseForm groupId={id} members={data.members} expense={expense} />
    </div>
  );
}

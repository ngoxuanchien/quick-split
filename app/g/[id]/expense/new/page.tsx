import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGroup } from '@/db/queries';
import { ExpenseForm } from '../expense-form';

// always reads fresh DB data; blocking render is intended
export const instant = false;

export default async function NewExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getGroup(id);
  if (!data) notFound();
  return (
    <div className="space-y-4">
      <Link href={`/g/${id}`} className="text-sm text-emerald-700">
        ← {data.group.name}
      </Link>
      <h1 className="text-xl font-bold">Thêm khoản chi</h1>
      <ExpenseForm groupId={id} members={data.members} />
    </div>
  );
}

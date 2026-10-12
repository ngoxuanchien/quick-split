import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addMember, deleteExpense, deleteMember, recordPayment, renameMember } from '@/app/actions';
import { getGroup, type GroupData } from '@/db/queries';
import { formatVnd } from '@/lib/money';
import { balances, settle } from '@/lib/split';
import { CopyLink } from './copy-link';
import { DeleteButton } from './delete-button';

const TABS = [
  ['expenses', 'Khoản chi'],
  ['balances', 'Số dư'],
  ['members', 'Thành viên'],
] as const;

// always reads fresh DB data; blocking render is intended
export const instant = false;

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = 'expenses' } = await searchParams;
  const data = await getGroup(id);
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="truncate text-xl font-bold">{data.group.name}</h1>
        <CopyLink />
      </header>
      <nav className="grid grid-cols-3 rounded-lg bg-gray-200 p-1 text-center text-sm">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/g/${id}?tab=${key}`}
            className={`rounded-md py-1.5 ${tab === key ? 'bg-white font-medium shadow-sm' : 'text-gray-600'}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === 'members' && <MembersTab data={data} />}
      {tab === 'balances' && <BalancesTab data={data} />}
      {tab !== 'members' && tab !== 'balances' && <ExpensesTab data={data} />}
    </div>
  );
}

function MembersTab({ data }: { data: GroupData }) {
  const id = data.group.id;
  const used = new Set(data.expenses.flatMap((e) => [e.payerId, ...e.splits.map((s) => s.memberId)]));
  const minReached = data.members.length <= 2;
  return (
    <div className="card space-y-3">
      {data.members.map((m) => {
        const locked = minReached || used.has(m.id);
        return (
          <div key={m.id} className="flex items-center gap-2">
            <form action={renameMember.bind(null, id, m.id)} className="flex flex-1 gap-2">
              <input name="name" defaultValue={m.name} required maxLength={50} className="input" />
              <button className="text-sm text-emerald-700">Lưu</button>
            </form>
            <form action={deleteMember.bind(null, id, m.id)}>
              <button
                disabled={locked}
                title={used.has(m.id) ? 'Đã có khoản chi, không xoá được' : minReached ? 'Nhóm cần ít nhất 2 người' : undefined}
                className="text-sm text-red-600 disabled:text-gray-300"
              >
                Xoá
              </button>
            </form>
          </div>
        );
      })}
      <form action={addMember.bind(null, id)} className="flex gap-2 border-t border-gray-200 pt-3">
        <input name="name" required maxLength={50} placeholder="Tên thành viên mới" className="input" />
        <button className="btn">Thêm</button>
      </form>
    </div>
  );
}

function ExpensesTab({ data }: { data: GroupData }) {
  const id = data.group.id;
  const name = new Map(data.members.map((m) => [m.id, m.name]));
  return (
    <div className="space-y-3">
      <Link href={`/g/${id}/expense/new`} className="btn block text-center">
        + Thêm khoản chi
      </Link>
      {data.expenses.length === 0 && <p className="text-center text-gray-500">Chưa có khoản chi nào.</p>}
      {data.expenses.map((e) => (
        <div key={e.id} className="card flex items-center gap-3">
          <Link href={`/g/${id}/expense/${e.id}`} className="min-w-0 flex-1">
            <div className="truncate font-medium">{e.title}</div>
            <div className="text-sm text-gray-500">
              {name.get(e.payerId)} trả · {e.createdAt.toLocaleDateString('vi-VN')}
            </div>
          </Link>
          <div className="font-semibold">{formatVnd(e.amount)}</div>
          <DeleteButton action={deleteExpense.bind(null, id, e.id)} confirmText={`Xoá "${e.title}"?`} />
        </div>
      ))}
    </div>
  );
}

function BalancesTab({ data }: { data: GroupData }) {
  const id = data.group.id;
  const name = new Map(data.members.map((m) => [m.id, m.name]));
  const bal = balances(data.expenses);
  const transfers = settle(bal);
  return (
    <div className="space-y-4">
      <div className="card space-y-2">
        {data.members.map((m) => {
          const v = bal.get(m.id) ?? 0;
          return (
            <div key={m.id} className="flex justify-between">
              <span>{m.name}</span>
              <span className={v > 0 ? 'text-emerald-700' : v < 0 ? 'text-red-600' : 'text-gray-500'}>
                {v > 0 ? '+' : ''}
                {formatVnd(v)}
              </span>
            </div>
          );
        })}
      </div>
      <h2 className="font-semibold">Cách trả nợ</h2>
      {transfers.length === 0 && <p className="text-gray-500">Mọi người đã cân bằng 🎉</p>}
      {transfers.map((t) => (
        <div key={`${t.from}-${t.to}`} className="card flex items-center gap-3">
          <div className="flex-1">
            <b>{name.get(t.from)}</b> → <b>{name.get(t.to)}</b>
            <div className="font-semibold">{formatVnd(t.amount)}</div>
          </div>
          <form action={recordPayment.bind(null, id, t.from, t.to, t.amount)}>
            <button className="btn">Đã trả</button>
          </form>
        </div>
      ))}
    </div>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addMember, deleteExpense, deleteMember, recordPayment, renameMember } from '@/app/actions';
import { getGroup, type GroupData } from '@/db/queries';
import { formatDateVn } from '@/lib/date';
import { formatVnd } from '@/lib/money';
import { expensePath, groupPath } from '@/lib/routes';
import { summarize, type Summary } from '@/lib/summary';
import { CopyLink } from './copy-link';
import { DeleteButton } from './delete-button';
import { MemberNameForm } from './member-name-form';
import { SubmitButton } from './submit-button';

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
  const sum = summarize(data);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="truncate text-xl font-bold">{data.group.name}</h1>
          <CopyLink />
        </div>
        <p className="muted text-sm">
          {data.members.length} người · Tổng chi {formatVnd(sum.total)}
        </p>
      </header>
      <nav className="sticky top-0 z-10 -mx-4 bg-gray-50/90 px-4 py-2 backdrop-blur dark:bg-gray-950/90">
        <div className="grid grid-cols-3 rounded-lg bg-gray-200 p-1 text-center text-sm dark:bg-gray-800">
          {TABS.map(([key, label]) => (
            <Link
              key={key}
              href={groupPath(id, key)}
              className={`rounded-md py-1.5 ${tab === key ? 'bg-white font-medium text-emerald-700 shadow-sm dark:bg-gray-900 dark:text-emerald-400' : 'muted'}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>
      {tab === 'members' && <MembersTab data={data} />}
      {tab === 'balances' && <BalancesTab data={data} sum={sum} />}
      {tab !== 'members' && tab !== 'balances' && <ExpensesTab data={data} />}
    </div>
  );
}

function deleteHint(used: boolean, minReached: boolean) {
  if (used) return 'Đã có khoản chi, không xoá được';
  if (minReached) return 'Nhóm cần ít nhất 2 người';
  return undefined;
}

function balanceClass(v: number) {
  if (v > 0) return 'text-emerald-700 dark:text-emerald-400';
  if (v < 0) return 'text-red-600 dark:text-red-400';
  return 'muted';
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
          <div key={m.id} className="flex items-start gap-2">
            <MemberNameForm
              action={renameMember.bind(null, id, m.id)}
              defaultValue={m.name}
              label="Lưu"
              buttonClass="text-sm text-emerald-700"
            />
            <form action={deleteMember.bind(null, id, m.id)} className="pt-2">
              <button
                disabled={locked}
                title={deleteHint(used.has(m.id), minReached)}
                className="text-sm text-red-600 disabled:text-gray-300"
              >
                Xoá
              </button>
            </form>
          </div>
        );
      })}
      <div className="border-t border-gray-200 pt-3">
        <MemberNameForm action={addMember.bind(null, id)} placeholder="Tên thành viên mới" label="Thêm" buttonClass="btn" />
      </div>
    </div>
  );
}

function ExpensesTab({ data }: { data: GroupData }) {
  const id = data.group.id;
  const name = new Map(data.members.map((m) => [m.id, m.name]));
  return (
    <div className="space-y-3">
      <Link href={expensePath(id, 'new')} className="btn block text-center">
        + Thêm khoản chi
      </Link>
      {data.expenses.length === 0 && <p className="text-center muted">Chưa có khoản chi nào.</p>}
      {data.expenses.map((e) => (
        <div key={e.id} className="card flex items-center gap-3">
          <Link href={expensePath(id, e.id)} className="min-w-0 flex-1">
            <div className="truncate font-medium">{e.title}</div>
            <div className="text-sm muted">
              {name.get(e.payerId)} trả · {formatDateVn(e.createdAt)}
            </div>
          </Link>
          <div className="font-semibold">{formatVnd(e.amount)}</div>
          <DeleteButton action={deleteExpense.bind(null, id, e.id)} confirmText={`Xoá "${e.title}"?`} />
        </div>
      ))}
    </div>
  );
}

function BalancesTab({ data, sum }: { data: GroupData; sum: Summary }) {
  const id = data.group.id;
  const name = new Map(data.members.map((m) => [m.id, m.name]));
  const bal = new Map(sum.rows.map((r) => [r.member.id, r.balance]));
  const transfers = sum.transfers;
  return (
    <div className="space-y-4">
      <div className="card space-y-2">
        {data.members.map((m) => {
          const v = bal.get(m.id) ?? 0;
          return (
            <div key={m.id} className="flex justify-between">
              <span>{m.name}</span>
              <span className={balanceClass(v)}>
                {v > 0 ? '+' : ''}
                {formatVnd(v)}
              </span>
            </div>
          );
        })}
      </div>
      <h2 className="font-semibold">Cách trả nợ</h2>
      {transfers.length === 0 && <p className="muted">Mọi người đã cân bằng 🎉</p>}
      {transfers.map((t) => (
        <div key={`${t.from}-${t.to}`} className="card flex items-center gap-3">
          <div className="flex-1">
            <b>{name.get(t.from)}</b> → <b>{name.get(t.to)}</b>
            <div className="font-semibold">{formatVnd(t.amount)}</div>
          </div>
          <form action={recordPayment.bind(null, id, t.from, t.to, t.amount)}>
            <SubmitButton>Đã trả</SubmitButton>
          </form>
        </div>
      ))}
    </div>
  );
}

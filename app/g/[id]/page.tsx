import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addMember, deleteExpense, deleteMember, recordPayment, updateMember } from '@/app/actions';
import { getGroup, type GroupData } from '@/db/queries';
import { bankByBin } from '@/lib/banks';
import { formatDateVn } from '@/lib/date';
import { formatVnd } from '@/lib/money';
import { transferQrs } from '@/lib/qr';
import { expensePath, groupPath } from '@/lib/routes';
import { summarize, type Summary } from '@/lib/summary';
import { Avatar } from './avatar';
import { CopyLink } from './copy-link';
import { ConfirmForm, DeleteButton } from './delete-button';
import { MemberEditForm } from './member-edit-form';
import { MemberNameForm } from './member-name-form';
import { ShareImage } from './share-image';
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
    <div className="space-y-3">
      {data.members.map((m) => {
        const hint = deleteHint(used.has(m.id), minReached);
        const bank = bankByBin(m.bankBin);
        return (
          <details key={m.id} className="card">
            <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
              <Avatar id={m.id} name={m.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{m.name}</div>
                <div className="muted truncate text-sm">{bank && m.accountNo ? `${bank.name} · ${m.accountNo}` : 'Chưa có STK'}</div>
              </div>
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Sửa</span>
            </summary>
            <MemberEditForm action={updateMember.bind(null, id, m.id)} member={m} />
            <form action={deleteMember.bind(null, id, m.id)} className="mt-2 flex items-center justify-end gap-2">
              {hint && <span className="muted text-xs">{hint}</span>}
              <button disabled={!!hint} className="text-sm text-red-600 disabled:text-gray-300 dark:disabled:text-gray-600">
                Xoá thành viên
              </button>
            </form>
          </details>
        );
      })}
      <div className="card">
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

async function BalancesTab({ data, sum }: { data: GroupData; sum: Summary }) {
  const id = data.group.id;
  const name = new Map(data.members.map((m) => [m.id, m.name]));
  const qrs = await transferQrs(data.group.name, sum.transfers);
  return (
    <div className="space-y-4">
      <ShareImage groupId={id} groupName={data.group.name} />
      <div className="card space-y-3">
        {sum.rows.map(({ member: m, balance: v }) => (
          <div key={m.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <Avatar id={m.id} name={m.name} size="sm" />
              <span className="flex-1 truncate">{m.name}</span>
              <span className={`font-medium ${balanceClass(v)}`}>
                {v > 0 ? '+' : ''}
                {formatVnd(v)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className={`h-full rounded-full ${v >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                style={{ width: `${(Math.abs(v) / sum.maxAbs) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <h2 className="font-semibold">Cách trả nợ</h2>
      {sum.transfers.length === 0 && <p className="muted">Mọi người đã cân bằng 🎉</p>}
      {sum.transfers.map((t, i) => {
        const from = name.get(t.from)!;
        const to = name.get(t.to)!;
        return (
          <div key={`${t.from}-${t.to}`} className="card space-y-3">
            <div className="flex items-center gap-2">
              <Avatar id={t.from} name={from} size="sm" />
              <b className="truncate">{from}</b>
              <span className="muted">→</span>
              <Avatar id={t.to} name={to} size="sm" />
              <b className="truncate">{to}</b>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-lg font-bold">{formatVnd(t.amount)}</div>
              <ConfirmForm
                action={recordPayment.bind(null, id, t.from, t.to, t.amount)}
                confirmText={`Xác nhận ${from} đã trả ${to} ${formatVnd(t.amount)}?`}
              >
                <SubmitButton>Đã trả</SubmitButton>
              </ConfirmForm>
            </div>
            {qrs[i] && t.account && (
              <details>
                <summary className="cursor-pointer text-sm font-medium text-emerald-700 dark:text-emerald-400">Hiện QR chuyển khoản</summary>
                <div className="mt-3 flex flex-col items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URI, nothing to optimize */}
                  <img src={qrs[i]} alt={`QR chuyển ${formatVnd(t.amount)} cho ${to}`} className="size-56 rounded-lg bg-white p-2" />
                  <p className="text-sm">
                    {t.account.bank.name} · {t.account.accountNo}
                  </p>
                  <p className="muted text-xs">Mở app ngân hàng → Quét QR</p>
                  <p className="text-center text-xs text-amber-700 dark:text-amber-400">
                    ⚠️ Kiểm tra đúng tên {to} trên app ngân hàng trước khi chuyển. Ai có link nhóm đều sửa được STK.
                  </p>
                </div>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

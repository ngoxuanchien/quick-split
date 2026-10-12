import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addMember, deleteExpense, deleteMember, recordPayment, updateMember } from '@/app/actions';
import { getGroup, type GroupData } from '@/db/queries';
import { bankByBin } from '@/lib/banks';
import { formatDateVn } from '@/lib/date';
import { formatVnd } from '@/lib/money';
import { transferQrs } from '@/lib/qr';
import { expensePath, groupPath } from '@/lib/routes';
import { isPayment, summarize, type Summary } from '@/lib/summary';
import { Avatar } from './avatar';
import { CopyLink } from './copy-link';
import { ConfirmForm, DeleteButton } from './delete-button';
import { MemberEditForm } from './member-edit-form';
import { MemberNameForm } from './member-name-form';
import { ShareImage } from './share-image';
import { SubmitButton } from './submit-button';

const TABS = [
  ['expenses', 'Khoản chi', '🧾'],
  ['balances', 'Số dư', '💜'],
  ['members', 'Thành viên', '👥'],
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
  const current = tab === 'members' || tab === 'balances' ? tab : 'expenses';

  return (
    <div className="pb-[calc(9rem+env(safe-area-inset-bottom))] lg:pb-12">
      <header className="hero px-4 pt-5 pb-4 lg:px-8 lg:pt-8 lg:pb-0">
        <div className="lg:mx-auto lg:flex lg:max-w-5xl lg:items-center lg:justify-between lg:gap-6">
          <div className="flex min-w-0 items-center justify-between gap-2 lg:justify-start lg:gap-3">
            <h1 className="truncate text-lg font-bold lg:text-2xl">{current === 'members' ? 'Thành viên' : data.group.name}</h1>
            <CopyLink />
          </div>
          {current === 'members' ? (
            <div className="mt-2 flex items-center justify-between gap-2 lg:mt-0 lg:gap-4">
              <p className="text-sm text-white/85">Lưu STK để bạn bè quét QR trả tiền</p>
              <a href="#add-member" className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand-600">
                ＋ Thêm
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-3 lg:shrink-0">
              <div className="glass mt-3 flex-1 px-4 py-3 lg:mt-0 lg:flex lg:items-center lg:gap-5">
                <div>
                  <p className="text-xs text-white/85">Tổng chi tiêu · {data.members.length} người</p>
                  <p className="text-2xl font-bold tracking-tight">{formatVnd(sum.total)}</p>
                </div>
                {current === 'balances' && (
                  <div className="mt-2 lg:mt-0">
                    <ShareImage groupId={id} groupName={data.group.name} />
                  </div>
                )}
              </div>
              <Link
                href={expensePath(id, 'new')}
                className="hidden shrink-0 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-accent-600 hover:bg-brand-50 lg:inline-flex"
              >
                ＋ Thêm khoản chi
              </Link>
            </div>
          )}
        </div>
        <nav aria-label="Chuyển tab" className="mx-auto mt-6 hidden max-w-5xl gap-1 lg:flex">
          {TABS.map(([key, label, icon]) => (
            <Link
              key={key}
              href={groupPath(id, key)}
              aria-current={current === key ? 'page' : undefined}
              className={`rounded-t-xl px-5 py-2.5 text-sm ${current === key ? 'bg-canvas font-bold text-brand-700 dark:bg-canvas-dark dark:text-brand-300' : 'text-white/85 hover:bg-white/10'}`}
            >
              <span aria-hidden>{icon}</span> {label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="px-4 pt-4 lg:px-8 lg:pt-6">
        <div className="lg:mx-auto lg:max-w-5xl">
          {current === 'members' && <MembersTab data={data} />}
          {current === 'balances' && <BalancesTab data={data} sum={sum} />}
          {current === 'expenses' && <ExpensesTab data={data} />}
        </div>
      </div>
      <nav
        aria-label="Chuyển tab"
        className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t lg:hidden border-brand-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-line-dark dark:bg-field-dark/95"
      >
        <div className="grid grid-cols-3">
          {TABS.map(([key, label, icon]) => (
            <Link
              key={key}
              href={groupPath(id, key)}
              aria-current={current === key ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${current === key ? 'font-bold text-brand-600 dark:text-brand-300' : 'text-gray-500 dark:text-brand-300/70'}`}
            >
              <span aria-hidden className="text-lg leading-none">
                {icon}
              </span>
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

function deleteHint(used: boolean, minReached: boolean) {
  if (used) return 'Đã có khoản chi, không xoá được';
  if (minReached) return 'Nhóm cần ít nhất 2 người';
  return undefined;
}

function balanceClass(v: number) {
  if (v > 0) return 'text-brand-600 dark:text-brand-300';
  if (v < 0) return 'text-accent-600 dark:text-accent-500';
  return 'muted';
}

function MembersTab({ data }: { data: GroupData }) {
  const id = data.group.id;
  const used = new Set(data.expenses.flatMap((e) => [e.payerId, ...e.splits.map((s) => s.memberId)]));
  const minReached = data.members.length <= 2;
  return (
    <div className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
      {data.members.map((m) => {
        const hint = deleteHint(used.has(m.id), minReached);
        const bank = bankByBin(m.bankBin);
        return (
          <details key={m.id} className="card group open:ring-2 open:ring-brand-300 dark:open:ring-brand-700">
            <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
              <Avatar id={m.id} name={m.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{m.name}</div>
                {bank && m.accountNo ? (
                  <div className="truncate text-xs text-emerald-600 dark:text-emerald-400">
                    🏦 {bank.name} · {m.accountNo}
                  </div>
                ) : (
                  <div className="muted text-xs">Chưa có STK</div>
                )}
              </div>
              <span className="link text-sm">
                <span className="group-open:hidden">Sửa</span>
                <span className="hidden group-open:inline">Đóng</span>
              </span>
            </summary>
            <MemberEditForm action={updateMember.bind(null, id, m.id)} member={m} />
            <form action={deleteMember.bind(null, id, m.id)} className="mt-2 flex items-center justify-end gap-2">
              {hint && <span className="muted text-xs">{hint}</span>}
              <button disabled={!!hint} className="text-sm text-red-600 disabled:text-gray-300 dark:text-red-400 dark:disabled:text-gray-600">
                Xoá thành viên
              </button>
            </form>
          </details>
        );
      })}
      <div id="add-member" className="card scroll-mt-4 space-y-2 lg:col-span-2">
        <p className="text-sm font-bold">Thêm thành viên</p>
        <MemberNameForm action={addMember.bind(null, id)} placeholder="Tên thành viên mới" label="Thêm" buttonClass="btn shrink-0" />
      </div>
    </div>
  );
}

function ExpensesTab({ data }: { data: GroupData }) {
  const id = data.group.id;
  const name = new Map(data.members.map((m) => [m.id, m.name]));
  return (
    <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
      {data.expenses.length === 0 && (
        <div className="card space-y-2 py-10 text-center lg:col-span-2">
          <div className="text-4xl">🧾</div>
          <p className="font-bold">Chưa có khoản chi nào</p>
          <p className="muted text-sm">Bấm “+” để ghi khoản đầu tiên, ví dụ tiền ăn hay tiền phòng.</p>
        </div>
      )}
      {data.expenses.map((e) =>
        isPayment(e) ? (
          <div key={e.id} className="muted flex items-center gap-3 px-2 py-1 text-sm">
            <span aria-hidden>↔</span>
            <span className="min-w-0 flex-1 truncate">
              {name.get(e.payerId)} đã trả {name.get(e.splits[0].memberId)} · {formatDateVn(e.createdAt)}
            </span>
            <span>{formatVnd(e.amount)}</span>
            <DeleteButton action={deleteExpense.bind(null, id, e.id)} confirmText="Xoá khoản thanh toán này?" />
          </div>
        ) : (
          <div key={e.id} className="card flex items-center gap-3">
            <Avatar id={e.payerId} name={name.get(e.payerId)!} />
            <Link href={expensePath(id, e.id)} className="min-w-0 flex-1">
              <div className="truncate font-bold">{e.title}</div>
              <div className="truncate text-xs text-brand-500 dark:text-brand-300/80">
                {name.get(e.payerId)} trả · {formatDateVn(e.createdAt)}
              </div>
            </Link>
            <div className="font-bold">{formatVnd(e.amount)}</div>
            <DeleteButton action={deleteExpense.bind(null, id, e.id)} confirmText={`Xoá "${e.title}"?`} />
          </div>
        ),
      )}
      <Link
        href={expensePath(id, 'new')}
        aria-label="Thêm khoản chi"
        className="fixed right-[max(1rem,calc((100vw-32rem)/2+1rem))] bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-2xl lg:hidden bg-linear-to-br from-brand-600 to-accent-600 text-3xl text-white shadow-[0_10px_24px_rgba(219,39,119,0.4)] hover:brightness-110"
      >
        +
      </Link>
    </div>
  );
}

async function BalancesTab({ data, sum }: { data: GroupData; sum: Summary }) {
  const id = data.group.id;
  const name = new Map(data.members.map((m) => [m.id, m.name]));
  const qrs = await transferQrs(data.group.name, sum.transfers);
  return (
    <div className="space-y-4 lg:grid lg:grid-cols-[340px_1fr] lg:items-start lg:gap-5 lg:space-y-0">
      <div className="card space-y-3">
        {sum.rows.map(({ member: m, balance: v }) => (
          <div key={m.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <Avatar id={m.id} name={m.name} size="sm" />
              <span className="flex-1 truncate">{m.name}</span>
              <span className={`font-bold ${balanceClass(v)}`}>
                {v > 0 ? '+' : ''}
                {formatVnd(v)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-brand-50 dark:bg-line-dark">
              <div
                className={`h-full rounded-full ${v >= 0 ? 'bg-brand-500' : 'bg-accent-500'}`}
                style={{ width: `${(Math.abs(v) / sum.maxAbs) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <h2 className="font-bold">Ai trả ai</h2>
        {sum.transfers.length === 0 && <p className="muted">Mọi người đã cân bằng 🎉</p>}
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
          {sum.transfers.map((t, i) => {
            const from = name.get(t.from)!;
            const to = name.get(t.to)!;
            const qr = t.account ? qrs[i] : undefined;
            return (
              <div key={`${t.from}-${t.to}`} className="card space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar id={t.from} name={from} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{from}</div>
                    <div className="truncate text-xs text-brand-500 dark:text-brand-300/80">trả cho {to}</div>
                  </div>
                  <div className="text-lg font-bold text-accent-600 dark:text-accent-500">{formatVnd(t.amount)}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {qr && t.account && (
                    <details className="group open:col-span-2">
                      <summary className="btn-soft w-full cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                        <span className="group-open:hidden">Quét QR</span>
                        <span className="hidden group-open:inline">Ẩn QR</span>
                      </summary>
                      <div className="mt-3 flex flex-col items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element -- data URI, nothing to optimize */}
                        <img src={qr} alt={`QR chuyển ${formatVnd(t.amount)} cho ${to}`} className="size-56 rounded-2xl bg-white p-2" />
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
                  <div className={qr ? '[details[open]+&]:col-span-2' : 'col-span-2'}>
                    <ConfirmForm
                      action={recordPayment.bind(null, id, t.from, t.to, t.amount)}
                      confirmText={`Xác nhận ${from} đã trả ${to} ${formatVnd(t.amount)}?`}
                    >
                      <SubmitButton className="btn w-full">Đã trả</SubmitButton>
                    </ConfirmForm>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

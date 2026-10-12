import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addMember, deleteExpense, deleteMember, recordPayment, renameMember } from '@/app/actions';
import { getGroup, type GroupData } from '@/db/queries';
import { formatDate } from '@/lib/date';
import { dicts, type Dict, type Locale } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';
import { formatVnd } from '@/lib/money';
import { expensePath, groupPath } from '@/lib/routes';
import { MAX_MEMBERS } from '@/lib/validation';
import { balances, isPayment, settle } from '@/lib/split';
import { CopyLink } from './copy-link';
import { DeleteButton } from './delete-button';
import { MemberNameForm } from './member-name-form';
import { SubmitButton } from './submit-button';

const TABS = ['expenses', 'balances', 'members'] as const;

type Props = { data: GroupData; t: Dict; locale: Locale };

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
  const locale = await getLocale();
  const props = { data, t: dicts[locale], locale };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="truncate text-xl font-bold">{data.group.name}</h1>
        <CopyLink />
      </header>
      <nav className="grid grid-cols-3 rounded-lg bg-gray-200 p-1 text-center text-sm">
        {TABS.map((key) => (
          <Link
            key={key}
            href={groupPath(id, key)}
            className={`rounded-md py-1.5 ${tab === key ? 'bg-white font-medium shadow-sm' : 'text-gray-600'}`}
          >
            {props.t.group.tabs[key]}
          </Link>
        ))}
      </nav>
      {tab === 'members' && <MembersTab {...props} />}
      {tab === 'balances' && <BalancesTab {...props} />}
      {tab !== 'members' && tab !== 'balances' && <ExpensesTab {...props} />}
    </div>
  );
}

function deleteHint(t: Dict, used: boolean, minReached: boolean) {
  if (used) return t.members.deleteUsed;
  if (minReached) return t.members.deleteMin;
  return undefined;
}

function balanceClass(v: number) {
  if (v > 0) return 'text-emerald-700';
  if (v < 0) return 'text-red-600';
  return 'text-gray-500';
}

function MembersTab({ data, t }: Props) {
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
              label={t.common.save}
              buttonClass="text-sm text-emerald-700"
            />
            <form action={deleteMember.bind(null, id, m.id)} className="pt-2">
              <button
                disabled={locked}
                title={deleteHint(t, used.has(m.id), minReached)}
                className="text-sm text-red-600 disabled:text-gray-300"
              >
                {t.common.delete}
              </button>
            </form>
          </div>
        );
      })}
      {data.members.length < MAX_MEMBERS && (
        <div className="border-t border-gray-200 pt-3">
          <MemberNameForm action={addMember.bind(null, id)} placeholder={t.members.newPlaceholder} label={t.common.add} buttonClass="btn" />
        </div>
      )}
    </div>
  );
}

const chip = 'rounded-full px-2.5 py-0.5 text-sm';

function MemberChips({ data, t }: Props) {
  const chips = data.members.map((m) => (
    <span key={m.id} className={`${chip} bg-gray-100`}>
      {m.name}
    </span>
  ));
  if (data.members.length >= MAX_MEMBERS) return <div className="flex flex-wrap gap-1.5">{chips}</div>;
  // native <details> toggles the inline form without client JS
  return (
    <details>
      <summary className="flex cursor-pointer list-none flex-wrap gap-1.5 [&::-webkit-details-marker]:hidden">
        {chips}
        <span className={`${chip} border border-dashed border-emerald-600 text-emerald-700`}>{t.members.addPerson}</span>
      </summary>
      <div className="mt-2">
        <MemberNameForm action={addMember.bind(null, data.group.id)} placeholder={t.members.newPlaceholder} label={t.common.add} buttonClass="btn" />
      </div>
    </details>
  );
}

function ExpensesTab(props: Props) {
  const { data, t, locale } = props;
  const id = data.group.id;
  const name = new Map(data.members.map((m) => [m.id, m.name]));
  return (
    <div className="space-y-3">
      <MemberChips {...props} />
      <Link href={expensePath(id, 'new')} className="btn block text-center">
        {t.expense.add}
      </Link>
      {data.expenses.length === 0 && <p className="text-center text-gray-500">{t.expense.empty}</p>}
      {data.expenses.map((e) => {
        const title = isPayment(e) ? t.expense.payment : e.title;
        return (
          <div key={e.id} className="card flex items-center gap-3">
            <Link href={expensePath(id, e.id)} className="min-w-0 flex-1">
              <div className="truncate font-medium">{title}</div>
              <div className="text-sm text-gray-500">
                {t.expense.paidBy(name.get(e.payerId) ?? '')} · {formatDate(e.createdAt, locale)}
              </div>
            </Link>
            <div className="font-semibold">{formatVnd(e.amount, locale)}</div>
            <DeleteButton action={deleteExpense.bind(null, id, e.id)} confirmText={t.expense.confirmDelete(title)} />
          </div>
        );
      })}
    </div>
  );
}

function BalancesTab({ data, t, locale }: Props) {
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
              <span className={balanceClass(v)}>
                {v > 0 ? '+' : ''}
                {formatVnd(v, locale)}
              </span>
            </div>
          );
        })}
      </div>
      <h2 className="font-semibold">{t.balances.howToSettle}</h2>
      {transfers.length === 0 && <p className="text-gray-500">{t.balances.settled}</p>}
      {transfers.map((tr) => (
        <div key={`${tr.from}-${tr.to}`} className="card flex items-center gap-3">
          <div className="flex-1">
            <b>{name.get(tr.from)}</b> → <b>{name.get(tr.to)}</b>
            <div className="font-semibold">{formatVnd(tr.amount, locale)}</div>
          </div>
          <form action={recordPayment.bind(null, id, tr.from, tr.to, tr.amount)}>
            <SubmitButton>{t.balances.paid}</SubmitButton>
          </form>
        </div>
      ))}
    </div>
  );
}

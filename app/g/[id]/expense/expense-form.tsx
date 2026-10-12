'use client';

import { type FormEvent, useState, useTransition } from 'react';
import { saveExpense } from '@/app/actions';
import { formatVnd, parseVnd } from '@/lib/money';
import { computeShares, type Split, type SplitType } from '@/lib/split';
import { useLocale, useT } from '@/app/locale-provider';

type Member = { id: number; name: string };
type Expense = { id: number; title: string; amount: number; payerId: number; splitType: SplitType; splits: Split[] };

const TYPES: SplitType[] = ['equal', 'exact', 'shares'];

export function ExpenseForm({ groupId, members, expense }: { groupId: string; members: Member[]; expense?: Expense }) {
  const t = useT();
  const locale = useLocale();
  const initial = (t: SplitType, fallback: string): Record<number, string> =>
    Object.fromEntries(
      members.map((m) => {
        const s = expense?.splitType === t ? expense.splits.find((x) => x.memberId === m.id) : undefined;
        return [m.id, s ? String(s.value) : fallback];
      }),
    );

  const [title, setTitle] = useState(expense?.title ?? '');
  const [amountText, setAmountText] = useState(expense ? String(expense.amount) : '');
  const [payerId, setPayerId] = useState(expense?.payerId ?? members[0].id);
  const [splitType, setSplitType] = useState<SplitType>(expense?.splitType ?? 'equal');
  const [equal, setEqual] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(
      members.map((m) => [m.id, expense?.splitType === 'equal' ? expense.splits.some((s) => s.memberId === m.id) : true]),
    ),
  );
  const [exact, setExact] = useState(() => initial('exact', ''));
  // editing a shares expense: members without a stored split had 0 shares, keep it that way
  const [shares, setShares] = useState(() => initial('shares', expense?.splitType === 'shares' ? '0' : '1'));
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const amount = parseVnd(amountText);
  const typed = splitType === 'exact' ? exact : shares;
  const splits: Split[] =
    splitType === 'equal'
      ? members.filter((m) => equal[m.id]).map((m) => ({ memberId: m.id, value: 1 }))
      : members.map((m) => ({ memberId: m.id, value: parseVnd(typed[m.id] ?? '') })).filter((s) => s.value > 0);
  const owed = computeShares(amount, splitType, splits);
  const exactSum = splits.reduce((a, s) => a + s.value, 0);

  function submit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveExpense(groupId, expense?.id ?? null, { title, amount, payerId, splitType, splits });
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">{t.expense.title}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={100} placeholder={t.expense.titlePlaceholder} className="input" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">
          {t.expense.amount} {amount > 0 && <span className="text-gray-500">= {formatVnd(amount, locale)}</span>}
        </span>
        <input value={amountText} onChange={(e) => setAmountText(e.target.value)} required inputMode="numeric" placeholder="300000" className="input" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">{t.expense.payer}</span>
        <select value={payerId} onChange={(e) => setPayerId(Number(e.target.value))} className="input">
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-3 rounded-lg bg-gray-200 p-1 text-center text-sm">
        {TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setSplitType(type)}
            className={`rounded-md py-1.5 ${splitType === type ? 'bg-white font-medium shadow-sm' : 'text-gray-600'}`}
          >
            {t.expense.splitTypes[type]}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-2">
            {splitType === 'equal' && (
              <input
                type="checkbox"
                checked={!!equal[m.id]}
                onChange={(e) => setEqual({ ...equal, [m.id]: e.target.checked })}
                className="size-5"
                aria-label={m.name}
              />
            )}
            <span className="flex-1">{m.name}</span>
            {splitType === 'exact' && (
              <input
                value={exact[m.id]}
                onChange={(e) => setExact({ ...exact, [m.id]: e.target.value })}
                inputMode="numeric"
                placeholder="0"
                className="input w-32 text-right"
                aria-label={t.expense.amountOf(m.name)}
              />
            )}
            {splitType === 'shares' && (
              <input
                value={shares[m.id]}
                onChange={(e) => setShares({ ...shares, [m.id]: e.target.value })}
                inputMode="numeric"
                className="input w-16 text-right"
                aria-label={t.expense.sharesOf(m.name)}
              />
            )}
            <span className="w-28 text-right text-sm text-gray-600">{owed.has(m.id) ? formatVnd(owed.get(m.id)!, locale) : '–'}</span>
          </li>
        ))}
      </ul>
      {splitType === 'exact' && (
        <p className={`text-sm ${exactSum === amount ? 'text-gray-600' : 'text-red-600'}`}>
          {t.expense.splitTotal(formatVnd(exactSum, locale), formatVnd(amount, locale))}
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={pending} className="btn w-full">
        {pending ? t.common.saving : t.common.save}
      </button>
    </form>
  );
}

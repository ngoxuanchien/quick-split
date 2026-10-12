'use client';

import { type FormEvent, useState, useTransition } from 'react';
import { saveExpense } from '@/app/actions';
import { formatVnd, parseVnd } from '@/lib/money';
import { computeShares, type Split, type SplitType } from '@/lib/split';

type Member = { id: number; name: string };
type Expense = { id: number; title: string; amount: number; payerId: number; splitType: SplitType; splits: Split[] };

const TYPES: [SplitType, string][] = [
  ['equal', 'Chia đều'],
  ['exact', 'Theo số tiền'],
  ['shares', 'Theo phần'],
];

export function ExpenseForm({ groupId, members, expense }: { groupId: string; members: Member[]; expense?: Expense }) {
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
  const [shares, setShares] = useState(() => initial('shares', '1'));
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const amount = parseVnd(amountText);
  const splits: Split[] =
    splitType === 'equal'
      ? members.filter((m) => equal[m.id]).map((m) => ({ memberId: m.id, value: 1 }))
      : members
          .map((m) => ({ memberId: m.id, value: parseVnd((splitType === 'exact' ? exact : shares)[m.id] ?? '') }))
          .filter((s) => s.value > 0);
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
        <span className="text-sm font-medium">Tên khoản chi</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={100} placeholder="Ăn tối" className="input" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">
          Số tiền {amount > 0 && <span className="text-gray-500">= {formatVnd(amount)}</span>}
        </span>
        <input value={amountText} onChange={(e) => setAmountText(e.target.value)} required inputMode="numeric" placeholder="300000" className="input" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Người trả</span>
        <select value={payerId} onChange={(e) => setPayerId(Number(e.target.value))} className="input">
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-3 rounded-lg bg-gray-200 p-1 text-center text-sm">
        {TYPES.map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setSplitType(t)}
            className={`rounded-md py-1.5 ${splitType === t ? 'bg-white font-medium shadow-sm' : 'text-gray-600'}`}
          >
            {label}
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
                aria-label={`Số tiền của ${m.name}`}
              />
            )}
            {splitType === 'shares' && (
              <input
                value={shares[m.id]}
                onChange={(e) => setShares({ ...shares, [m.id]: e.target.value })}
                inputMode="numeric"
                className="input w-16 text-right"
                aria-label={`Số phần của ${m.name}`}
              />
            )}
            <span className="w-28 text-right text-sm text-gray-600">{owed.has(m.id) ? formatVnd(owed.get(m.id)!) : '–'}</span>
          </li>
        ))}
      </ul>
      {splitType === 'exact' && (
        <p className={`text-sm ${exactSum === amount ? 'text-gray-600' : 'text-red-600'}`}>
          Tổng chia: {formatVnd(exactSum)} / {formatVnd(amount)}
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={pending} className="btn w-full">
        {pending ? 'Đang lưu…' : 'Lưu'}
      </button>
    </form>
  );
}

export type SplitType = 'equal' | 'exact' | 'shares';
export type Split = { memberId: number; value: number };
export type ExpenseLike = { amount: number; payerId: number; splitType: SplitType; splits: Split[] };
export type Transfer = { from: number; to: number; amount: number };

export function computeShares(amount: number, splitType: SplitType, splits: Split[]): Map<number, number> {
  const owed = new Map<number, number>();
  if (splitType === 'exact') {
    for (const s of splits) owed.set(s.memberId, s.value);
    return owed;
  }
  const weights = splits.map((s) => (splitType === 'equal' ? 1 : s.value));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return owed;
  let assigned = 0;
  splits.forEach((s, i) => {
    const v = Math.floor((amount * weights[i]) / total);
    owed.set(s.memberId, v);
    assigned += v;
  });
  // leftover is < splits.length; hand out 1đ each in split order
  for (let i = 0; assigned < amount; i++, assigned++) {
    const id = splits[i % splits.length].memberId;
    owed.set(id, owed.get(id)! + 1);
  }
  return owed;
}

export function balances(expenses: ExpenseLike[]): Map<number, number> {
  const bal = new Map<number, number>();
  const add = (id: number, v: number) => bal.set(id, (bal.get(id) ?? 0) + v);
  for (const e of expenses) {
    add(e.payerId, e.amount);
    for (const [id, v] of computeShares(e.amount, e.splitType, e.splits)) add(id, -v);
  }
  return bal;
}

// ponytail: greedy, at most n-1 transfers; not the true minimum (NP-hard), fine for friend groups
export function settle(bal: Map<number, number>): Transfer[] {
  const debtors = [...bal].filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const creditors = [...bal].filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const out: Transfer[] = [];
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.v - a.v);
    creditors.sort((a, b) => b.v - a.v);
    const d = debtors[0];
    const c = creditors[0];
    const amount = Math.min(d.v, c.v);
    out.push({ from: d.id, to: c.id, amount });
    d.v -= amount;
    c.v -= amount;
    if (d.v === 0) debtors.shift();
    if (c.v === 0) creditors.shift();
  }
  return out;
}

export function isOwed(expenses: ExpenseLike[], t: Transfer): boolean {
  return settle(balances(expenses)).some((x) => x.from === t.from && x.to === t.to && x.amount === t.amount);
}

// settle-up payments are stored as expenses with this title (never translated: it is data)
export const PAYMENT_TITLE = 'Thanh toán';

export function isPayment(e: { title: string; splitType: SplitType; splits: Split[] }): boolean {
  return e.title === PAYMENT_TITLE && e.splitType === 'exact' && e.splits.length === 1;
}

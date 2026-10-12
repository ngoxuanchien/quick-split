import { type Bank, bankByBin } from './banks';
import { balances, type ExpenseLike, settle, type Split, type SplitType, type Transfer } from './split';

export const PAYMENT_TITLE = 'Thanh toán';

export const isPayment = (e: { title: string; splitType: SplitType; splits: Split[] }) =>
  e.title === PAYMENT_TITLE && e.splitType === 'exact' && e.splits.length === 1;

export type SummaryMember = { id: number; name: string; bankBin?: string | null; accountNo?: string | null };
export type SummaryTransfer = Transfer & { account?: { bank: Bank; accountNo: string } };
export type Summary = {
  total: number;
  maxAbs: number;
  rows: { member: SummaryMember; balance: number }[];
  transfers: SummaryTransfer[];
};

export function summarize(data: { members: SummaryMember[]; expenses: (ExpenseLike & { title: string })[] }): Summary {
  const bal = balances(data.expenses);
  const byId = new Map(data.members.map((m) => [m.id, m]));
  const rows = data.members.map((m) => ({ member: m, balance: bal.get(m.id) ?? 0 }));
  const transfers = settle(bal).map((t): SummaryTransfer => {
    const to = byId.get(t.to);
    const bank = bankByBin(to?.bankBin);
    return bank && to?.accountNo ? { ...t, account: { bank, accountNo: to.accountNo } } : t;
  });
  return {
    total: data.expenses.filter((e) => !isPayment(e)).reduce((a, e) => a + e.amount, 0),
    maxAbs: Math.max(1, ...rows.map((r) => Math.abs(r.balance))),
    rows,
    transfers,
  };
}

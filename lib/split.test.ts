import { describe, expect, it } from 'vitest';
import { balances, computeShares, isOwed, isPayment, PAYMENT_TITLE, settle, type ExpenseLike } from './split';

const sum = (m: Map<number, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe('computeShares', () => {
  it('equal split, even', () => {
    const r = computeShares(300, 'equal', [{ memberId: 1, value: 1 }, { memberId: 2, value: 1 }, { memberId: 3, value: 1 }]);
    expect([...r]).toEqual([[1, 100], [2, 100], [3, 100]]);
  });

  it('equal split with remainder sums exactly, first members get the extra đồng', () => {
    const r = computeShares(100000, 'equal', [{ memberId: 1, value: 1 }, { memberId: 2, value: 1 }, { memberId: 3, value: 1 }]);
    expect([...r]).toEqual([[1, 33334], [2, 33333], [3, 33333]]);
    expect(sum(r)).toBe(100000);
  });

  it('equal ignores value and treats every listed member as one share', () => {
    const r = computeShares(200, 'equal', [{ memberId: 1, value: 5 }, { memberId: 2, value: 1 }]);
    expect([...r]).toEqual([[1, 100], [2, 100]]);
  });

  it('shares split proportionally with remainder', () => {
    const r = computeShares(1000, 'shares', [{ memberId: 1, value: 2 }, { memberId: 2, value: 1 }]);
    expect([...r]).toEqual([[1, 667], [2, 333]]);
    expect(sum(r)).toBe(1000);
  });

  it('exact returns values as given', () => {
    const r = computeShares(500, 'exact', [{ memberId: 1, value: 200 }, { memberId: 2, value: 300 }]);
    expect([...r]).toEqual([[1, 200], [2, 300]]);
  });

  it('returns empty map when there are no splits', () => {
    expect(computeShares(500, 'equal', []).size).toBe(0);
  });
});

describe('balances', () => {
  it('payer gets credit, participants get debit, sum is zero', () => {
    const expenses: ExpenseLike[] = [
      { amount: 300, payerId: 1, splitType: 'equal', splits: [{ memberId: 1, value: 1 }, { memberId: 2, value: 1 }, { memberId: 3, value: 1 }] },
      { amount: 100, payerId: 2, splitType: 'exact', splits: [{ memberId: 3, value: 100 }] },
    ];
    const b = balances(expenses);
    expect(b.get(1)).toBe(200);
    expect(b.get(2)).toBe(0);
    expect(b.get(3)).toBe(-200);
    expect(sum(b)).toBe(0);
  });
});

describe('settle', () => {
  it('matches largest debtor with largest creditor', () => {
    const t = settle(new Map([[1, 300], [2, -100], [3, -200]]));
    expect(t).toEqual([
      { from: 3, to: 1, amount: 200 },
      { from: 2, to: 1, amount: 100 },
    ]);
  });

  it('zeroes every balance and uses at most n-1 transfers', () => {
    const bal = new Map([[1, 500], [2, -50], [3, -150], [4, 200], [5, -500]]);
    const t = settle(bal);
    const after = new Map(bal);
    for (const { from, to, amount } of t) {
      after.set(from, after.get(from)! + amount);
      after.set(to, after.get(to)! - amount);
    }
    expect([...after.values()].every((v) => v === 0)).toBe(true);
    expect(t.length).toBeLessThanOrEqual(bal.size - 1);
  });

  it('returns nothing when everyone is settled', () => {
    expect(settle(new Map([[1, 0], [2, 0]]))).toEqual([]);
  });
});

describe('isOwed', () => {
  const dinner: ExpenseLike = { amount: 300, payerId: 1, splitType: 'equal', splits: [{ memberId: 1, value: 1 }, { memberId: 2, value: 1 }, { memberId: 3, value: 1 }] };
  it('true for a transfer still in the settle list', () => {
    expect(isOwed([dinner], { from: 2, to: 1, amount: 100 })).toBe(true);
  });
  it('false once that payment is recorded (blocks double "Đã trả")', () => {
    const paid: ExpenseLike = { amount: 100, payerId: 2, splitType: 'exact', splits: [{ memberId: 1, value: 100 }] };
    expect(isOwed([dinner, paid], { from: 2, to: 1, amount: 100 })).toBe(false);
  });
});

describe('isPayment', () => {
  const pay = { title: PAYMENT_TITLE, splitType: 'exact' as const, splits: [{ memberId: 2, value: 100 }] };
  it('detects a recorded settle-up payment', () => expect(isPayment(pay)).toBe(true));
  it('does not relabel a user expense with the same title but an equal split', () => {
    expect(isPayment({ ...pay, splitType: 'equal', splits: [{ memberId: 1, value: 1 }, { memberId: 2, value: 1 }] })).toBe(false);
  });
  it('needs exactly one split', () => {
    expect(isPayment({ ...pay, splits: [{ memberId: 1, value: 50 }, { memberId: 2, value: 50 }] })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { AVATAR_COLORS, avatarColor, initial } from './avatar';
import { isPayment, PAYMENT_TITLE, summarize } from './summary';

const members = [
  { id: 1, name: 'An', bankBin: '970437', accountNo: '123456789' },
  { id: 2, name: 'Bình', bankBin: null, accountNo: null },
];
const dinner = { title: 'Ăn tối', amount: 300, payerId: 1, splitType: 'equal' as const, splits: [{ memberId: 1, value: 1 }, { memberId: 2, value: 1 }] };
const payment = { title: PAYMENT_TITLE, amount: 50, payerId: 2, splitType: 'exact' as const, splits: [{ memberId: 1, value: 50 }] };

describe('summarize', () => {
  it('totals spending excluding payments, rows follow member order', () => {
    const s = summarize({ members, expenses: [dinner, payment] });
    expect(s.total).toBe(300);
    expect(s.rows.map((r) => [r.member.id, r.balance])).toEqual([[1, 100], [2, -100]]);
    expect(s.maxAbs).toBe(100);
  });
  it('attaches the receiver bank account to transfers', () => {
    const [t] = summarize({ members, expenses: [dinner] }).transfers;
    expect(t).toMatchObject({ from: 2, to: 1, amount: 150, account: { accountNo: '123456789', bank: { code: 'HDBank' } } });
  });
  it('no account when receiver has none or an unknown bin', () => {
    const flipped = { ...dinner, payerId: 2 };
    expect(summarize({ members, expenses: [flipped] }).transfers[0].account).toBeUndefined();
    const bad = [{ ...members[0], bankBin: '000000' }, members[1]];
    expect(summarize({ members: bad, expenses: [dinner] }).transfers[0].account).toBeUndefined();
  });
  it('maxAbs is at least 1 when everyone is even', () => {
    expect(summarize({ members, expenses: [] }).maxAbs).toBe(1);
  });
});

describe('isPayment', () => {
  it('only matches the recorded-payment shape', () => {
    expect(isPayment(payment)).toBe(true);
    expect(isPayment({ ...payment, splitType: 'equal' })).toBe(false);
    expect(isPayment(dinner)).toBe(false);
  });
});

describe('avatar', () => {
  it('initial is uppercase first letter, ? when empty', () => {
    expect(initial('  đức')).toBe('Đ');
    expect(initial('')).toBe('?');
  });
  it('color is stable and from the palette', () => {
    expect(avatarColor(7)).toBe(avatarColor(7));
    expect(AVATAR_COLORS).toContain(avatarColor(123));
  });
});

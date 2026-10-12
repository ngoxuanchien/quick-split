import { describe, expect, it } from 'vitest';
import { dicts, type Dict } from './i18n';
import { expenseInput, firstError, groupInput, MAX_AMOUNT, MAX_MEMBERS, memberAccount } from './validation';

const { vi, en } = dicts;
const ok = { title: 'Ăn tối', amount: 300000, payerId: 1, splitType: 'equal' as const, splits: [{ memberId: 1, value: 1 }, { memberId: 2, value: 1 }] };
const err = (input: unknown, t: Dict = vi) => {
  const r = expenseInput.safeParse(input);
  return r.success ? null : firstError(r.error, t);
};

describe('groupInput', () => {
  it('accepts a name and 2+ members, trimming', () => {
    const r = groupInput.parse({ name: ' Đà Lạt ', members: [' An', 'Bình '] });
    expect(r).toEqual({ name: 'Đà Lạt', members: ['An', 'Bình'] });
  });
  it('rejects fewer than 2 members', () => {
    const r = groupInput.safeParse({ name: 'x', members: ['An'] });
    expect(firstError(r.error!, vi)).toBe('Cần ít nhất 2 thành viên');
  });
  it('rejects duplicate names case-insensitively', () => {
    const r = groupInput.safeParse({ name: 'x', members: ['An', 'an'] });
    expect(r.success).toBe(false);
    expect(firstError(r.error!, vi)).toBe('Tên thành viên bị trùng');
    expect(firstError(r.error!, en)).toBe('Member name already exists');
  });
  it('rejects empty group name', () => {
    const r = groupInput.safeParse({ name: '  ', members: ['An', 'Bình'] });
    expect(firstError(r.error!, vi)).toBe('Nhập tên nhóm');
  });
  it('caps members at MAX_MEMBERS', () => {
    const names = (n: number) => Array.from({ length: n }, (_, i) => `M${i}`);
    expect(groupInput.safeParse({ name: 'x', members: names(MAX_MEMBERS) }).success).toBe(true);
    const r = groupInput.safeParse({ name: 'x', members: names(MAX_MEMBERS + 1) });
    expect(firstError(r.error!, vi)).toBe(`Tối đa ${MAX_MEMBERS} thành viên`);
  });
});

describe('expenseInput', () => {
  it('accepts a valid equal expense', () => expect(err(ok)).toBeNull());
  it('rejects zero amount', () => expect(err({ ...ok, amount: 0 })).toBe('Số tiền phải lớn hơn 0'));
  it('rejects amount above the cap', () => expect(err({ ...ok, amount: MAX_AMOUNT + 1 })).toBe('Số tiền quá lớn'));
  it('rejects empty title', () => expect(err({ ...ok, title: ' ' })).toBe('Nhập tên khoản chi'));
  it('rejects empty title in en', () => expect(err({ ...ok, title: ' ' }, en)).toBe('Enter an expense name'));
  it('rejects no participants', () => expect(err({ ...ok, splits: [] })).toBe('Chọn ít nhất 1 người'));
  it('rejects duplicate participants', () => {
    expect(err({ ...ok, splits: [{ memberId: 1, value: 1 }, { memberId: 1, value: 1 }] })).toBe('Thành viên bị trùng');
  });
  it('rejects exact split whose sum differs from amount', () => {
    const bad = { ...ok, splitType: 'exact', amount: 500, splits: [{ memberId: 1, value: 200 }, { memberId: 2, value: 200 }] };
    expect(err(bad)).toBe('Tổng chia (400đ) phải bằng số tiền (500đ)');
    expect(err(bad, en)).toBe('Split total (400₫) must equal the amount (500₫)');
  });
  it('accepts exact split whose sum matches', () => {
    expect(err({ ...ok, splitType: 'exact', amount: 500, splits: [{ memberId: 1, value: 200 }, { memberId: 2, value: 300 }] })).toBeNull();
  });
  it('rejects shares above 1000', () => {
    expect(err({ ...ok, splitType: 'shares', splits: [{ memberId: 1, value: 1001 }] })).toBe('Số phần tối đa 1000');
  });
});

describe('expenseInput: huge values get localized messages', () => {
  it('amount 1e16', () => expect(err({ ...ok, amount: 1e16 })).toBe('Số tiền quá lớn'));
  it('amount Infinity falls back to the localized invalid message', () => {
    expect(err({ ...ok, amount: Infinity })).toBe('Dữ liệu không hợp lệ');
    expect(err({ ...ok, amount: Infinity }, en)).toBe('Invalid data');
  });
  it('shares value 1e16', () => {
    expect(err({ ...ok, splitType: 'shares', splits: [{ memberId: 1, value: 1e16 }] })).toBe('Giá trị chia quá lớn');
  });
});

describe('memberAccount', () => {
  const parse = (bankBin: string, accountNo: string) => memberAccount.safeParse({ bankBin, accountNo });
  const msg = (bankBin: string, accountNo: string) => {
    const r = parse(bankBin, accountNo);
    return r.success ? null : firstError(r.error, vi);
  };
  it('both empty clears the account', () => expect(parse('', ' ').data).toEqual({ bankBin: null, accountNo: null }));
  it('strips spaces, dots and dashes', () => {
    expect(parse('970437', '0123 456.78-9').data).toEqual({ bankBin: '970437', accountNo: '0123456789' });
  });
  it('requires both fields', () => {
    expect(msg('970437', '')).toBe('Nhập đủ ngân hàng và số tài khoản');
    expect(msg('', '123456')).toBe('Nhập đủ ngân hàng và số tài khoản');
  });
  it('rejects unknown bank', () => expect(msg('000000', '123456')).toBe('Ngân hàng không hợp lệ'));
  it('rejects letters and wrong length', () => {
    expect(msg('970437', '12345a')).toBe('Số tài khoản gồm 6–19 chữ số');
    expect(msg('970437', '12345')).toBe('Số tài khoản gồm 6–19 chữ số');
    expect(msg('970437', '1'.repeat(20))).toBe('Số tài khoản gồm 6–19 chữ số');
  });
});

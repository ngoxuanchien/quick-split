import { describe, expect, it } from 'vitest';
import { expenseInput, firstError, groupInput, MAX_AMOUNT } from './validation';

const ok = { title: 'Ăn tối', amount: 300000, payerId: 1, splitType: 'equal' as const, splits: [{ memberId: 1, value: 1 }, { memberId: 2, value: 1 }] };
const err = (input: unknown) => {
  const r = expenseInput.safeParse(input);
  return r.success ? null : firstError(r.error);
};

describe('groupInput', () => {
  it('accepts a name and 2+ members, trimming', () => {
    const r = groupInput.parse({ name: ' Đà Lạt ', members: [' An', 'Bình '] });
    expect(r).toEqual({ name: 'Đà Lạt', members: ['An', 'Bình'] });
  });
  it('rejects fewer than 2 members', () => {
    expect(groupInput.safeParse({ name: 'x', members: ['An'] }).success).toBe(false);
  });
  it('rejects duplicate names case-insensitively', () => {
    const r = groupInput.safeParse({ name: 'x', members: ['An', 'an'] });
    expect(r.success).toBe(false);
    expect(firstError(r.error!)).toBe('Tên thành viên bị trùng');
  });
  it('rejects empty group name', () => {
    expect(groupInput.safeParse({ name: '  ', members: ['An', 'Bình'] }).success).toBe(false);
  });
});

describe('expenseInput', () => {
  it('accepts a valid equal expense', () => expect(err(ok)).toBeNull());
  it('rejects zero amount', () => expect(err({ ...ok, amount: 0 })).toBe('Số tiền phải lớn hơn 0'));
  it('rejects amount above the cap', () => expect(err({ ...ok, amount: MAX_AMOUNT + 1 })).toBe('Số tiền quá lớn'));
  it('rejects empty title', () => expect(err({ ...ok, title: ' ' })).toBe('Nhập tên khoản chi'));
  it('rejects no participants', () => expect(err({ ...ok, splits: [] })).toBe('Chọn ít nhất 1 người'));
  it('rejects duplicate participants', () => {
    expect(err({ ...ok, splits: [{ memberId: 1, value: 1 }, { memberId: 1, value: 1 }] })).toBe('Thành viên bị trùng');
  });
  it('rejects exact split whose sum differs from amount', () => {
    expect(err({ ...ok, splitType: 'exact', amount: 500, splits: [{ memberId: 1, value: 200 }, { memberId: 2, value: 200 }] }))
      .toBe('Tổng chia (400đ) phải bằng số tiền (500đ)');
  });
  it('accepts exact split whose sum matches', () => {
    expect(err({ ...ok, splitType: 'exact', amount: 500, splits: [{ memberId: 1, value: 200 }, { memberId: 2, value: 300 }] })).toBeNull();
  });
  it('rejects shares above 1000', () => {
    expect(err({ ...ok, splitType: 'shares', splits: [{ memberId: 1, value: 1001 }] })).toBe('Số phần tối đa 1000');
  });
});

describe('expenseInput: huge values get Vietnamese messages', () => {
  it('amount 1e16', () => expect(err({ ...ok, amount: 1e16 })).toBe('Số tiền quá lớn'));
  it('amount Infinity is not reported in English', () => {
    expect(err({ ...ok, amount: Infinity })).not.toMatch(/Invalid|expected/);
  });
  it('shares value 1e16', () => {
    expect(err({ ...ok, splitType: 'shares', splits: [{ memberId: 1, value: 1e16 }] })).toBe('Giá trị chia quá lớn');
  });
});

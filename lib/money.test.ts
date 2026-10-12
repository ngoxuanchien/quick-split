import { describe, expect, it } from 'vitest';
import { formatVnd, parseVnd } from './money';

describe('parseVnd', () => {
  it('reads plain digits', () => expect(parseVnd('150000')).toBe(150000));
  it('ignores dot, comma and space separators', () => {
    expect(parseVnd('150.000')).toBe(150000);
    expect(parseVnd('150,000')).toBe(150000);
    expect(parseVnd('150 000đ')).toBe(150000);
  });
  it('returns 0 for empty or non-numeric', () => {
    expect(parseVnd('')).toBe(0);
    expect(parseVnd('abc')).toBe(0);
  });
});

describe('formatVnd', () => {
  it('formats with vi-VN grouping and đ', () => expect(formatVnd(150000)).toBe('150.000đ'));
  it('keeps the minus sign', () => expect(formatVnd(-5000)).toBe('-5.000đ'));
  it('formats en with comma grouping and ₫', () => expect(formatVnd(150000, 'en')).toBe('150,000₫'));
  it('keeps the minus sign in en', () => expect(formatVnd(-5000, 'en')).toBe('-5,000₫'));
});

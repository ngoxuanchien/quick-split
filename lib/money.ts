import type { Locale } from './i18n';

const FMT = { vi: new Intl.NumberFormat('vi-VN'), en: new Intl.NumberFormat('en-US') };

// always VND; only digit grouping and symbol follow the UI language
export function formatVnd(n: number, locale: Locale = 'vi'): string {
  return locale === 'vi' ? FMT.vi.format(n) + 'đ' : FMT.en.format(n) + '₫';
}

export function parseVnd(s: string): number {
  const digits = s.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

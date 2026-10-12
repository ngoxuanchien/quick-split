const fmt = new Intl.NumberFormat('vi-VN');

export function formatVnd(n: number): string {
  return fmt.format(n) + 'đ';
}

export function parseVnd(s: string): number {
  const digits = s.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

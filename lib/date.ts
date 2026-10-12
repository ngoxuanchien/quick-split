// fixed zone: the server (e.g. Vercel) runs in UTC, users are in Vietnam
export function formatDateVn(d: Date): string {
  return d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

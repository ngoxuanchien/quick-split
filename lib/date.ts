import type { Locale } from './i18n';

// fixed zone: the server (e.g. Vercel) runs in UTC, users are in Vietnam
const timeZone = 'Asia/Ho_Chi_Minh';

export function formatDate(d: Date, locale: Locale = 'vi'): string {
  return locale === 'vi'
    ? d.toLocaleDateString('vi-VN', { timeZone })
    : d.toLocaleDateString('en-GB', { timeZone, dateStyle: 'medium' });
}

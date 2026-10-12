import { en } from './en';
import { vi } from './vi';

export type Dict = typeof vi;
export type Locale = 'vi' | 'en';

export const LOCALES: readonly Locale[] = ['vi', 'en'];
export const DEFAULT_LOCALE: Locale = 'vi';
export const LOCALE_COOKIE = 'locale';

export const dicts: Record<Locale, Dict> = { vi, en };

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);

// cookie (explicit choice) → Accept-Language (highest q first) → vi
export function pickLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(cookie)) return cookie;
  const langs = (acceptLanguage ?? '')
    .split(',')
    .map((part) => {
      const [tag, ...attrs] = part.trim().split(';');
      const q = attrs.map((a) => a.trim()).find((a) => a.startsWith('q='));
      return { lang: tag.split('-')[0].toLowerCase(), q: q ? Number(q.slice(2)) : 1 };
    })
    .filter((l) => l.q > 0) // drops q=0 and unparsable q (NaN)
    .sort((a, b) => b.q - a.q); // stable: equal q keeps header order
  const match = langs.find((l) => isLocale(l.lang));
  return match ? (match.lang as Locale) : DEFAULT_LOCALE;
}

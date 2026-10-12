'use client';

import { createContext, use } from 'react';
import { DEFAULT_LOCALE, dicts, type Locale } from '@/lib/i18n';

// only the locale string crosses the server/client boundary; dictionaries ship in the bundle
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export const useLocale = () => use(LocaleContext);
export const useT = () => dicts[useLocale()];

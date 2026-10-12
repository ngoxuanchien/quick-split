import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { dicts, LOCALE_COOKIE, pickLocale, type Dict, type Locale } from '.';

export const getLocale = cache(async (): Promise<Locale> => {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return pickLocale(c.get(LOCALE_COOKIE)?.value, h.get('accept-language'));
});

export async function getT(): Promise<Dict> {
  return dicts[await getLocale()];
}

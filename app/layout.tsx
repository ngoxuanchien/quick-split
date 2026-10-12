import type { Metadata } from 'next';
import { dicts, LOCALES } from '@/lib/i18n';
import { getLocale, getT } from '@/lib/i18n/server';
import { setLocale } from './actions';
import { LocaleProvider } from './locale-provider';
import './globals.css';

// reads the locale cookie / Accept-Language on every request; blocking render is intended
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: 'Quick Split', description: t.meta.description };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="bg-gray-50 text-gray-900">
        <main className="mx-auto max-w-lg p-4">
          <form action={setLocale} aria-label={dicts[locale].common.language} className="flex justify-end gap-2 text-xs">
            {LOCALES.map((l) => (
              <button
                key={l}
                name="locale"
                value={l}
                aria-pressed={l === locale}
                className={l === locale ? 'font-bold' : 'text-gray-500'}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </form>
          <LocaleProvider locale={locale}>{children}</LocaleProvider>
        </main>
      </body>
    </html>
  );
}

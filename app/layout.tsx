import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { dicts, LOCALES } from '@/lib/i18n';
import { getLocale, getT } from '@/lib/i18n/server';
import { setLocale } from './actions';
import { LocaleProvider } from './locale-provider';
import './globals.css';

// bundled TTFs (also used by the summary PNG): no font download at build or runtime
const beVietnam = localFont({
  src: [
    { path: '../assets/fonts/BeVietnamPro-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../assets/fonts/BeVietnamPro-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-be-vietnam',
  display: 'swap',
});

// reads the locale cookie / Accept-Language on every request; blocking render is intended
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: 'Quick Split', description: t.meta.description };
}

// native controls (select, scrollbars) follow the system theme
export const viewport: Viewport = { colorScheme: 'light dark', themeColor: '#6d28d9' };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={beVietnam.variable}>
      <body className="bg-canvas font-sans text-ink antialiased dark:bg-canvas-dark dark:text-violet-50">
        <main className="relative mx-auto min-h-dvh max-w-lg lg:max-w-none">
          {/* dark translucent pill: readable on the gradient heroes and on the plain canvas */}
          <form
            action={setLocale}
            aria-label={dicts[locale].common.language}
            className="absolute top-2 right-3 z-40 flex gap-0.5 rounded-full bg-black/25 p-0.5 text-[11px] font-semibold text-white backdrop-blur lg:right-6"
          >
            {LOCALES.map((l) => (
              <button
                key={l}
                name="locale"
                value={l}
                aria-pressed={l === locale}
                className={`rounded-full px-2 py-0.5 ${l === locale ? 'bg-white text-brand-700' : 'hover:bg-white/15'}`}
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

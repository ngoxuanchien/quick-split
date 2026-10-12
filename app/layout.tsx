import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
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

export const metadata: Metadata = { title: 'Quick Split', description: 'Chia tiền nhóm nhanh' };

// native controls (select, scrollbars) follow the system theme
export const viewport: Viewport = { colorScheme: 'light dark', themeColor: '#6d28d9' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={beVietnam.variable}>
      <body className="bg-canvas font-sans text-ink antialiased dark:bg-canvas-dark dark:text-violet-50">
        <main className="mx-auto min-h-dvh max-w-lg lg:max-w-none">{children}</main>
      </body>
    </html>
  );
}

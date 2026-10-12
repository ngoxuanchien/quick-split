import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Quick Split', description: 'Chia tiền nhóm nhanh' };

// native controls (select, scrollbars) follow the system theme
export const viewport: Viewport = { colorScheme: 'light dark' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className="bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <main className="mx-auto max-w-lg p-4">{children}</main>
      </body>
    </html>
  );
}

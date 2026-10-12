import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Quick Split', description: 'Chia tiền nhóm nhanh' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className="bg-gray-50 text-gray-900">
        <main className="mx-auto max-w-lg p-4">{children}</main>
      </body>
    </html>
  );
}

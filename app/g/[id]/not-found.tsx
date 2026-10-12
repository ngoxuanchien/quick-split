import Link from 'next/link';
import { getT } from '@/lib/i18n/server';

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="space-y-4 px-4 pt-8 text-center">
      <p>{t.group.notFound}</p>
      <Link href="/" className="link underline">
        {t.group.newGroup}
      </Link>
    </div>
  );
}

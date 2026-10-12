import { getT } from '@/lib/i18n/server';
import { CreateGroupForm } from './create-group-form';

export default async function Home() {
  const t = await getT();
  return (
    <div className="space-y-6 pt-8">
      <div>
        <h1 className="text-2xl font-bold">Quick Split</h1>
        <p className="text-gray-600">{t.home.tagline}</p>
      </div>
      <CreateGroupForm />
    </div>
  );
}

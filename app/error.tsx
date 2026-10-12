'use client';

import { useT } from './locale-provider';

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useT();
  return (
    <div className="space-y-4 px-4 pt-8 text-center">
      <p>{t.common.error}</p>
      <button onClick={() => retry()} className="btn">
        {t.common.retry}
      </button>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useT } from '@/app/locale-provider';

export function CopyLink() {
  const t = useT();
  const [status, setStatus] = useState<keyof typeof t.group.copyLink>('idle');
  return (
    <button
      type="button"
      className="btn-ghost shrink-0"
      onClick={async () => {
        try {
          // navigator.clipboard is undefined outside secure contexts (e.g. http://<LAN IP>)
          await navigator.clipboard.writeText(location.origin + location.pathname);
          setStatus('copied');
        } catch {
          setStatus('failed');
        }
        setTimeout(() => setStatus('idle'), 2000);
      }}
    >
      {t.group.copyLink[status]}
    </button>
  );
}

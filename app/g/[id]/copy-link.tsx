'use client';

import { useState } from 'react';

const LABEL = { idle: '🔗 Copy link', copied: 'Đã copy ✓', failed: 'Copy lỗi, hãy copy URL' };

export function CopyLink() {
  const [status, setStatus] = useState<keyof typeof LABEL>('idle');
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
      {LABEL[status]}
    </button>
  );
}

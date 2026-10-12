'use client';

import { useState } from 'react';

export function CopyLink() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="shrink-0 rounded-lg border border-gray-300 px-3 py-1 text-sm"
      onClick={async () => {
        await navigator.clipboard.writeText(location.origin + location.pathname);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'Đã copy ✓' : 'Copy link'}
    </button>
  );
}

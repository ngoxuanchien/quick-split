'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { qrNote } from '@/lib/vietqr';
import { summaryImagePath } from '@/lib/routes';

type Status = 'idle' | 'busy' | 'retry' | 'failed';

const probe = () => new File([], 'x.png', { type: 'image/png' });
const noop = () => () => {};

export function ShareImage({ groupId, groupName }: { groupId: string; groupName: string }) {
  // server snapshot false → no hydration mismatch; client re-renders with the real value
  const canShare = useSyncExternalStore(noop, () => !!navigator.canShare?.({ files: [probe()] }), () => false);
  const [status, setStatus] = useState<Status>('idle');
  const file = useRef<File | null>(null);
  const fileName = `quick-split-${qrNote(groupName).toLowerCase().replace(/ /g, '-') || 'nhom'}.png`;

  async function run() {
    setStatus('busy');
    try {
      if (!file.current) {
        const res = await fetch(summaryImagePath(groupId));
        if (!res.ok) throw new Error(String(res.status));
        file.current = new File([await res.blob()], fileName, { type: 'image/png' });
      }
      if (canShare) {
        try {
          await navigator.share({ files: [file.current], title: groupName });
        } catch (e) {
          // iOS: user activation expires during the fetch; the cached file shares on the next tap
          if ((e as Error).name === 'NotAllowedError') return setStatus('retry');
          if ((e as Error).name !== 'AbortError') throw e;
        }
      } else {
        const url = URL.createObjectURL(file.current);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
      file.current = null; // next tap fetches fresh data
      setStatus('idle');
    } catch {
      file.current = null;
      setStatus('failed');
    }
  }

  const label = {
    idle: canShare ? '📤 Chia sẻ ảnh tổng kết' : '⬇️ Tải ảnh tổng kết',
    busy: 'Đang tạo…',
    retry: 'Bấm lại để chia sẻ',
    failed: 'Lỗi, thử lại',
  }[status];

  return (
    <button type="button" onClick={run} disabled={status === 'busy'} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-700 hover:bg-brand-50 disabled:opacity-60">
      {label}
    </button>
  );
}

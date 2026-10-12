'use client';

import { useT } from '@/app/locale-provider';

export function DeleteButton({ action, confirmText }: { action: () => Promise<void>; confirmText: string }) {
  const t = useT();
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <button className="text-sm text-red-600">{t.common.delete}</button>
    </form>
  );
}

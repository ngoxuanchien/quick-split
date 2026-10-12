'use client';

import { useT } from '@/app/locale-provider';

export function ConfirmForm({ action, confirmText, children }: { action: () => Promise<void>; confirmText: string; children: React.ReactNode }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}

export function DeleteButton({ action, confirmText }: { action: () => Promise<void>; confirmText: string }) {
  const t = useT();
  return (
    <ConfirmForm action={action} confirmText={confirmText}>
      <button className="text-sm text-red-600">{t.common.delete}</button>
    </ConfirmForm>
  );
}

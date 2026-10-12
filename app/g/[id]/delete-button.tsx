'use client';

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
  return (
    <ConfirmForm action={action} confirmText={confirmText}>
      <button className="text-sm text-red-600">Xoá</button>
    </ConfirmForm>
  );
}

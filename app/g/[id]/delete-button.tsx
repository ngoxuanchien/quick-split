'use client';

export function DeleteButton({ action, confirmText }: { action: () => Promise<void>; confirmText: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <button className="text-sm text-red-600">Xoá</button>
    </form>
  );
}

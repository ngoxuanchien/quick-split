'use client';

import { useActionState } from 'react';
import type { Result } from '@/app/actions';

export function MemberNameForm({
  action,
  defaultValue = '',
  placeholder,
  label,
  buttonClass,
}: {
  action: (prev: Result, formData: FormData) => Promise<Result>;
  defaultValue?: string;
  placeholder?: string;
  label: string;
  buttonClass: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <div className="flex-1">
      <form action={formAction} className="flex gap-2">
        <input
          name="name"
          defaultValue={state?.input?.name ?? defaultValue}
          required
          maxLength={50}
          placeholder={placeholder}
          className="input"
        />
        <button disabled={pending} className={buttonClass}>
          {label}
        </button>
      </form>
      {state?.error && <p className="mt-1 text-sm text-red-600">{state.error}</p>}
    </div>
  );
}

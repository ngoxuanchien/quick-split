'use client';

import { useActionState } from 'react';
import type { Result } from '@/app/actions';
import { useT } from '@/app/locale-provider';
import { BANKS } from '@/lib/banks';

type Member = { name: string; bankBin: string | null; accountNo: string | null };

export function MemberEditForm({ action, member }: { action: (prev: Result, formData: FormData) => Promise<Result>; member: Member }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, undefined);
  const v = state?.input;
  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input name="name" defaultValue={v?.name ?? member.name} required maxLength={50} aria-label={t.members.name} className="input" />
      <div className="flex gap-2">
        <select key={v?.bankBin ?? member.bankBin ?? ''} name="bankBin" defaultValue={v?.bankBin ?? member.bankBin ?? ''} aria-label={t.members.bank} className="input">
          <option value="">{t.members.bankPlaceholder}</option>
          {BANKS.map((b) => (
            <option key={b.bin} value={b.bin}>
              {b.name}
            </option>
          ))}
        </select>
        <input
          name="accountNo"
          defaultValue={v?.accountNo ?? member.accountNo ?? ''}
          inputMode="numeric"
          maxLength={30}
          placeholder={t.members.accountNo}
          aria-label={t.members.accountNo}
          className="input"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="btn w-full">
        {pending ? t.common.saving : t.common.save}
      </button>
    </form>
  );
}

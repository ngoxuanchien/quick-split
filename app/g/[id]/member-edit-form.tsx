'use client';

import { useActionState } from 'react';
import type { Result } from '@/app/actions';
import { BANKS } from '@/lib/banks';

type Member = { name: string; bankBin: string | null; accountNo: string | null };

export function MemberEditForm({ action, member }: { action: (prev: Result, formData: FormData) => Promise<Result>; member: Member }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const v = state?.input;
  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input name="name" defaultValue={v?.name ?? member.name} required maxLength={50} aria-label="Tên" className="input" />
      <div className="flex gap-2">
        <select key={v?.bankBin ?? member.bankBin ?? ''} name="bankBin" defaultValue={v?.bankBin ?? member.bankBin ?? ''} aria-label="Ngân hàng" className="input">
          <option value="">Ngân hàng…</option>
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
          placeholder="Số tài khoản"
          aria-label="Số tài khoản"
          className="input"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="btn w-full">
        {pending ? 'Đang lưu…' : 'Lưu'}
      </button>
    </form>
  );
}

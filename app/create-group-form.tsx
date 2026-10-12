'use client';

import { useActionState } from 'react';
import { createGroup } from './actions';

export function CreateGroupForm() {
  const [state, action, pending] = useActionState(createGroup, undefined);
  return (
    <form action={action} className="card space-y-4 shadow-[0_10px_30px_rgba(124,58,237,0.15)]">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Tên nhóm</span>
        <input name="name" defaultValue={state?.input?.name} required maxLength={100} placeholder="Đà Lạt 2026" className="input" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Thành viên (mỗi dòng 1 người)</span>
        <textarea name="members" defaultValue={state?.input?.members} required rows={5} placeholder={'An\nBình\nChi'} className="input" />
      </label>
      {state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <button disabled={pending} className="btn w-full">
        {pending ? 'Đang tạo…' : 'Tạo nhóm →'}
      </button>
    </form>
  );
}

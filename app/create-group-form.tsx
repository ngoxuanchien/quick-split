'use client';

import { useActionState } from 'react';
import { createGroup } from './actions';
import { useT } from './locale-provider';

export function CreateGroupForm() {
  const t = useT();
  const [state, action, pending] = useActionState(createGroup, undefined);
  return (
    <form action={action} className="card space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">{t.home.groupName}</span>
        <input name="name" defaultValue={state?.input?.name} required maxLength={100} placeholder={t.home.groupNamePlaceholder} className="input" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">{t.home.members}</span>
        <textarea name="members" defaultValue={state?.input?.members} required rows={5} placeholder={t.home.membersPlaceholder} className="input" />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="btn w-full">
        {pending ? t.home.creating : t.home.create}
      </button>
    </form>
  );
}

import { z } from 'zod';
import { bankByBin } from './banks';
import type { Dict } from './i18n';
import { MAX_AMOUNT, MAX_MEMBERS, MAX_SHARES } from './limits';

export { MAX_AMOUNT, MAX_MEMBERS, MAX_SHARES };

export type ErrorKey = keyof Dict['errors'];
// schema messages are dictionary keys; firstError translates them for the request's locale
const k = (key: ErrorKey) => key;

export const memberName = z.string().trim().min(1, k('memberNameRequired')).max(50, k('memberNameTooLong'));

export const memberAccount = z
  .object({
    bankBin: z.string().trim(),
    accountNo: z.string().transform((s) => s.replace(/[\s.-]/g, '')),
  })
  .superRefine((a, ctx) => {
    if (!a.bankBin && !a.accountNo) return;
    if (!a.bankBin || !a.accountNo) ctx.addIssue({ code: 'custom', message: k('accountIncomplete') });
    else if (!bankByBin(a.bankBin)) ctx.addIssue({ code: 'custom', message: k('bankInvalid') });
    else if (!/^\d{6,19}$/.test(a.accountNo)) ctx.addIssue({ code: 'custom', message: k('accountInvalid') });
  })
  .transform((a) => (a.bankBin && a.accountNo ? a : { bankBin: null, accountNo: null }));

export const groupInput = z.object({
  name: z.string().trim().min(1, k('groupNameRequired')).max(100, k('groupNameTooLong')),
  members: z
    .array(memberName)
    .min(2, k('minMembers'))
    .max(MAX_MEMBERS, k('maxMembers'))
    .refine((a) => new Set(a.map((s) => s.toLowerCase())).size === a.length, k('duplicateMemberName')),
});

export const expenseInput = z
  .object({
    title: z.string().trim().min(1, k('titleRequired')).max(100, k('titleTooLong')),
    amount: z.number().max(MAX_AMOUNT, k('amountTooLarge')).int().positive(k('amountPositive')),
    payerId: z.number().int(),
    splitType: z.enum(['equal', 'exact', 'shares']),
    splits: z
      .array(z.object({ memberId: z.number().int(), value: z.number().max(MAX_AMOUNT, k('splitValueTooLarge')).int().positive() }))
      .min(1, k('participantsRequired')),
  })
  .superRefine((e, ctx) => {
    const ids = e.splits.map((s) => s.memberId);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: k('duplicateParticipant') });
    if (e.splitType === 'shares' && e.splits.some((s) => s.value > MAX_SHARES)) {
      ctx.addIssue({ code: 'custom', message: k('maxShares') });
    }
    if (e.splitType === 'exact') {
      const total = e.splits.reduce((a, s) => a + s.value, 0);
      if (total !== e.amount) {
        ctx.addIssue({ code: 'custom', message: k('exactMismatch'), params: { total, amount: e.amount } });
      }
    }
  });

export type ExpenseInput = z.infer<typeof expenseInput>;

// zod built-in messages (Infinity, wrong type; only reachable with tampered input) are not keys → generic message
export function firstError(e: z.ZodError, t: Dict): string {
  const issue = e.issues[0];
  if (!issue || !Object.hasOwn(t.errors, issue.message)) return t.errors.invalid;
  const msg = t.errors[issue.message as ErrorKey];
  if (typeof msg === 'string') return msg;
  return msg((issue as { params?: { total: number; amount: number } }).params!);
}

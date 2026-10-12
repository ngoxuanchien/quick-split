import { z } from 'zod';
import { formatVnd } from './money';

export const MAX_AMOUNT = 1_000_000_000_000;
export const MAX_SHARES = 1000;

export const memberName = z.string().trim().min(1, 'Nhập tên thành viên').max(50, 'Tên tối đa 50 ký tự');

export const groupInput = z.object({
  name: z.string().trim().min(1, 'Nhập tên nhóm').max(100, 'Tên nhóm tối đa 100 ký tự'),
  members: z
    .array(memberName)
    .min(2, 'Cần ít nhất 2 thành viên')
    .max(50, 'Tối đa 50 thành viên')
    .refine((a) => new Set(a.map((s) => s.toLowerCase())).size === a.length, 'Tên thành viên bị trùng'),
});

export const expenseInput = z
  .object({
    title: z.string().trim().min(1, 'Nhập tên khoản chi').max(100, 'Tên tối đa 100 ký tự'),
    amount: z.number().int().positive('Số tiền phải lớn hơn 0').max(MAX_AMOUNT, 'Số tiền quá lớn'),
    payerId: z.number().int(),
    splitType: z.enum(['equal', 'exact', 'shares']),
    splits: z
      .array(z.object({ memberId: z.number().int(), value: z.number().int().positive().max(MAX_AMOUNT) }))
      .min(1, 'Chọn ít nhất 1 người'),
  })
  .superRefine((e, ctx) => {
    const ids = e.splits.map((s) => s.memberId);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Thành viên bị trùng' });
    if (e.splitType === 'shares' && e.splits.some((s) => s.value > MAX_SHARES)) {
      ctx.addIssue({ code: 'custom', message: `Số phần tối đa ${MAX_SHARES}` });
    }
    if (e.splitType === 'exact') {
      const total = e.splits.reduce((a, s) => a + s.value, 0);
      if (total !== e.amount) {
        ctx.addIssue({ code: 'custom', message: `Tổng chia (${formatVnd(total)}) phải bằng số tiền (${formatVnd(e.amount)})` });
      }
    }
  });

export type ExpenseInput = z.infer<typeof expenseInput>;

export function firstError(e: z.ZodError): string {
  return e.issues[0]?.message ?? 'Dữ liệu không hợp lệ';
}

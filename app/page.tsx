import { CreateGroupForm } from './create-group-form';

const STEPS = [
  ['Tạo nhóm', 'Đặt tên, nhập thành viên'],
  ['Gửi link', 'Ai có link cũng ghi chi được'],
  ['Chia tiền', 'Xem ai nợ ai, quét QR để trả'],
] as const;

export default function Home() {
  return (
    <div className="space-y-6 pt-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">Quick Split</h1>
        <p className="muted">Chia tiền nhóm nhanh, không cần đăng nhập.</p>
      </div>
      <ol className="grid grid-cols-3 gap-2 text-center text-sm">
        {STEPS.map(([title, hint], i) => (
          <li key={title} className="card space-y-1 p-3">
            <div className="mx-auto flex size-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">{i + 1}</div>
            <div className="font-medium">{title}</div>
            <div className="muted text-xs">{hint}</div>
          </li>
        ))}
      </ol>
      <CreateGroupForm />
    </div>
  );
}

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="space-y-4 pt-8 text-center">
      <p>Không tìm thấy nhóm này. Kiểm tra lại link.</p>
      <Link href="/" className="text-emerald-700 underline">
        Tạo nhóm mới
      </Link>
    </div>
  );
}

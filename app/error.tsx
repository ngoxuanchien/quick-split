'use client';

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="space-y-4 px-4 pt-8 text-center">
      <p>Có lỗi xảy ra, có thể do mất kết nối. Vui lòng thử lại.</p>
      <button onClick={() => retry()} className="btn">
        Thử lại
      </button>
    </div>
  );
}

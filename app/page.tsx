import { CreateGroupForm } from './create-group-form';

const STEPS = ['① Tạo nhóm', '② Gửi link', '③ Quét QR'] as const;

export default function Home() {
  return (
    <div className="pb-10">
      <section className="hero rounded-b-[30px] px-5 pt-10 pb-16">
        <h1 className="text-3xl font-bold tracking-tight">Quick Split</h1>
        <p className="mt-1 text-white/85">
          Chia tiền nhóm trong 1 phút.
          <br />
          Không cần đăng nhập.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2 text-xs">
          {STEPS.map((s) => (
            <li key={s} className="rounded-full bg-white/20 px-3 py-1.5 font-semibold">
              {s}
            </li>
          ))}
        </ul>
      </section>
      <div className="-mt-10 px-4">
        <CreateGroupForm />
      </div>
    </div>
  );
}

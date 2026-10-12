import { CreateGroupForm } from './create-group-form';

const STEPS = ['① Tạo nhóm', '② Gửi link', '③ Quét QR'] as const;

export default function Home() {
  return (
    <div className="relative pb-10 lg:pb-0">
      {/* gradient backdrop: a band behind the title on mobile, the whole screen on desktop */}
      <div aria-hidden className="hero absolute inset-x-0 top-0 h-64 rounded-b-[30px] lg:h-full lg:rounded-none" />
      <div className="relative px-5 pt-10 lg:mx-auto lg:grid lg:min-h-dvh lg:max-w-5xl lg:grid-cols-[1fr_400px] lg:items-center lg:gap-12 lg:pt-0">
        <section className="text-white">
          <h1 className="text-3xl font-bold tracking-tight lg:text-5xl">Quick Split</h1>
          <p className="mt-1 text-white/85 lg:mt-3 lg:text-lg">
            Chia tiền nhóm trong 1 phút.
            <br />
            Không cần đăng nhập.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2 text-xs lg:mt-6 lg:text-sm">
            {STEPS.map((s) => (
              <li key={s} className="rounded-full bg-white/20 px-3 py-1.5 font-semibold">
                {s}
              </li>
            ))}
          </ul>
        </section>
        <div className="mt-6 lg:mt-0">
          <CreateGroupForm />
        </div>
      </div>
    </div>
  );
}

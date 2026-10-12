# Fintech UI Redesign (style B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every screen in the approved violet→pink fintech style (mockup B) without changing data, actions or logic.

**Architecture:** Design tokens and component classes live in `app/globals.css` (Tailwind v4 `@theme` + `@layer components`); Be Vietnam Pro is loaded with `next/font/local` from the TTFs already in `assets/fonts`. Pages are restyled in place; the group page gets a gradient hero header and a fixed bottom tab bar. The summary PNG gets the same palette.

**Tech Stack:** Next.js 16.4 (App Router, cacheComponents), React 19, Tailwind v4, Satori via `next/og`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-12-fintech-ui-design.md` (mockups: `.superpowers/brainstorm/88166-1791785202/content/screens-b.html`)

## Global Constraints

- No new dependencies; no data/schema/action/lib changes (except `SubmitButton` gaining an optional `className`).
- Fonts only 400 and 700 exist → use `font-bold`, never `font-extrabold`/`font-black` (would be faux-bold).
- Brand: `#7c3aed` (brand-600), `#db2777` (accent-600); hero gradient `linear-gradient(135deg, #6d28d9, #a21caf 60%, #ec4899)`, dark hero `linear-gradient(135deg, #4c1d95, #701a75 60%, #9d174d)`.
- Dark mode = system preference (Tailwind default `dark:`); every new surface needs a `dark:` style.
- All copy Vietnamese; keep existing copy unless the spec names new copy.
- Do not build in place (`npm run start` on :3000 uses `.next`); build in a temp worktree with `npm ci`.
- Never `git add` untracked `.agents/`, `.claude/`, `AGENTS.md`, `CLAUDE.md`, `skills-lock.json`, nor the other session's uncommitted edits to `README.md` and `docs/superpowers/{plans,specs}/2026-10-12-quick-split*.md` / `*share-qr-ui*.md`.
- Verification per task: `npx tsc --noEmit && npm run lint && npx vitest run lib` must pass, plus the screenshots named in the task (dev server: `npx next dev -p 3100`, Playwright at 375×800 and 1280×720, light and dark). Demo groups: `/g/8CCsERCZcromxgLsub048A` (has QR), `/g/TQYnO5LxiH_ZwXVu3NX8QA` (long names).

## Review Focus

1. **Bottom tab bar covers content** — last card, the "Đã trả" button of the last transfer, or the FAB hidden behind the fixed bar on a 375×667 screen. Expected: page has enough bottom padding (`pb-28`) and the FAB sits above the bar. (Task 2/3 screenshots scrolled to bottom)
2. **iPhone home indicator** — bar must respect `env(safe-area-inset-bottom)`; FAB offset includes it. (Task 2/3 code)
3. **QR open state layout** — opening "Quét QR" must make the QR panel full width and push "Đã trả" to its own full-width row, not squeeze the 224px QR into half a card. (Task 4 screenshot with QR open, 375px)
4. **Dark mode contrast** — muted text on `#1a1430`, brand text on dark surfaces, inputs on dark. Expected: readable (no gray-on-purple mush). (dark screenshots every task)
5. **Desktop width** — fixed tab bar and FAB align to the centred `max-w-lg` column, not the viewport edge. (1280px screenshots, Task 2/3)

---

### Task 1: Tokens, font, base layout, home page

**Files:**
- Modify: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/create-group-form.tsx`, `app/error.tsx`, `app/g/[id]/not-found.tsx`, `app/g/[id]/expense/new/page.tsx`, `app/g/[id]/expense/[eid]/page.tsx`, `app/g/[id]/page.tsx` (outer wrapper padding only)

**Interfaces:**
- Produces: Tailwind colors `brand-{50,100,300,500,600,700}`, `accent-{500,600,700}`, `ink`, `canvas`, `canvas-dark`, `surface-dark`, `field-dark`, `line-dark`; classes `.hero`, `.glass`, `.btn`, `.btn-soft`, `.btn-ghost`, `.card`, `.input`, `.muted`, `.link`; `main` has no padding (pages pad themselves).

- [ ] **Step 1: Replace `app/globals.css`**

```css
@import "tailwindcss";

@theme inline {
  --font-sans: var(--font-be-vietnam), ui-sans-serif, system-ui, sans-serif;
}

@theme {
  --color-brand-50: #f5f3ff;
  --color-brand-100: #ede9fe;
  --color-brand-300: #c4b5fd;
  --color-brand-500: #8b5cf6;
  --color-brand-600: #7c3aed;
  --color-brand-700: #6d28d9;
  --color-accent-500: #ec4899;
  --color-accent-600: #db2777;
  --color-accent-700: #be185d;
  --color-ink: #1e1b4b;
  --color-canvas: #f7f5ff;
  --color-canvas-dark: #0f0b1f;
  --color-surface-dark: #1a1430;
  --color-field-dark: #140f28;
  --color-line-dark: #2e2550;
}

@layer components {
  .hero {
    @apply text-white;
    background-image: linear-gradient(135deg, #6d28d9, #a21caf 60%, #ec4899);
  }
  @media (prefers-color-scheme: dark) {
    .hero {
      background-image: linear-gradient(135deg, #4c1d95, #701a75 60%, #9d174d);
    }
  }
  .glass {
    @apply rounded-2xl border border-white/25 bg-white/15 backdrop-blur dark:border-white/20 dark:bg-white/10;
  }
  .btn {
    @apply inline-flex items-center justify-center rounded-full bg-linear-to-r from-brand-600 to-accent-600 px-5 py-2.5 font-bold text-white shadow-[0_6px_16px_rgba(219,39,119,0.25)] transition hover:brightness-110 disabled:opacity-50;
  }
  .btn-soft {
    @apply inline-flex items-center justify-center rounded-full bg-brand-50 px-5 py-2.5 font-bold text-brand-700 hover:bg-brand-100 dark:bg-[#2a2148] dark:text-brand-300 dark:hover:bg-[#33295a];
  }
  .btn-ghost {
    @apply inline-flex items-center justify-center gap-1 rounded-full bg-white/20 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/30;
  }
  .card {
    @apply rounded-2xl bg-white p-4 shadow-[0_4px_14px_rgba(124,58,237,0.07)] dark:border dark:border-line-dark dark:bg-surface-dark dark:shadow-none;
  }
  .input {
    @apply w-full rounded-xl border-[1.5px] border-brand-100 bg-white px-3 py-2.5 outline-none focus:border-brand-500 dark:border-line-dark dark:bg-field-dark dark:focus:border-brand-500;
  }
  .muted {
    @apply text-gray-500 dark:text-brand-300/70;
  }
  .link {
    @apply font-semibold text-brand-600 dark:text-brand-300;
  }
}
```

- [ ] **Step 2: Replace `app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// bundled TTFs (also used by the summary PNG): no font download at build or runtime
const beVietnam = localFont({
  src: [
    { path: '../assets/fonts/BeVietnamPro-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../assets/fonts/BeVietnamPro-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-be-vietnam',
  display: 'swap',
});

export const metadata: Metadata = { title: 'Quick Split', description: 'Chia tiền nhóm nhanh' };

// native controls (select, scrollbars) follow the system theme
export const viewport: Viewport = { colorScheme: 'light dark', themeColor: '#6d28d9' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={beVietnam.variable}>
      <body className="bg-canvas font-sans text-ink antialiased dark:bg-canvas-dark dark:text-violet-50">
        <main className="mx-auto min-h-dvh max-w-lg">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Replace `app/page.tsx`**

```tsx
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
```

- [ ] **Step 4: `app/create-group-form.tsx`** — form `className="card space-y-4"` → `className="card space-y-4 shadow-[0_10px_30px_rgba(124,58,237,0.15)]"`; button text `'Tạo nhóm'` → `'Tạo nhóm →'`; error `<p className="text-sm text-red-600">` → `className="text-sm text-red-600 dark:text-red-400"`.

- [ ] **Step 5: Page padding now that `main` has none**
  - `app/error.tsx`: outer `className="space-y-4 pt-8 text-center"` → `"space-y-4 px-4 pt-8 text-center"`.
  - `app/g/[id]/not-found.tsx`: outer → `"space-y-4 px-4 pt-8 text-center"`; link `className="text-emerald-700 underline"` → `"link underline"`.
  - `app/g/[id]/expense/new/page.tsx` and `.../[eid]/page.tsx`: outer `className="space-y-4"` → `"space-y-4 px-4 py-5"`; back link `className="text-sm text-emerald-700"` → `"link text-sm"`.
  - `app/g/[id]/page.tsx`: outer `<div className="space-y-4">` → `<div className="space-y-4 px-4 py-4">` (Task 2 replaces this shell).

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm run lint && npx vitest run lib` → all pass.
Screenshots (375 light, 375 dark, 1280 light): `/`. Expected: gradient hero with rounded bottom, 3 step pills, form card overlapping hero, gradient "Tạo nhóm →" button, Be Vietnam Pro font (check computed font-family starts with the next/font name). Also open `/g/8CCsERCZcromxgLsub048A/expense/new` — readable, padded.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css app/layout.tsx app/page.tsx app/create-group-form.tsx app/error.tsx 'app/g/[id]/not-found.tsx' 'app/g/[id]/expense/new/page.tsx' 'app/g/[id]/expense/[eid]/page.tsx' 'app/g/[id]/page.tsx'
git commit -m "feat(ui): fintech design tokens, Be Vietnam Pro font and new home page"
```

---

### Task 2: Group page shell — hero header and bottom tab bar

**Files:**
- Modify: `app/g/[id]/page.tsx` (`TABS`, `GroupPage`, remove `<ShareImage>` from `BalancesTab`), `app/g/[id]/copy-link.tsx`, `app/g/[id]/share-image.tsx` (button class)

**Interfaces:**
- Consumes: `.hero`, `.glass`, `.btn-ghost`, brand colors (Task 1).
- Produces: `GroupPage` renders `<header className="hero">`, content in `<div className="px-4 pt-4">`, fixed `<nav aria-label="Chuyển tab">`; page root has `pb-28`. `ShareImage` now lives in the hero (Balances tab only).

- [ ] **Step 1: Replace `TABS` and the `GroupPage` return in `app/g/[id]/page.tsx`**

```tsx
const TABS = [
  ['expenses', 'Khoản chi', '🧾'],
  ['balances', 'Số dư', '💜'],
  ['members', 'Thành viên', '👥'],
] as const;
```

In `GroupPage`, after `const sum = summarize(data);` add `const current = tab === 'members' || tab === 'balances' ? tab : 'expenses';` and return:

```tsx
  return (
    <div className="pb-28">
      <header className="hero px-4 pt-5 pb-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="truncate text-lg font-bold">{current === 'members' ? 'Thành viên' : data.group.name}</h1>
          <CopyLink />
        </div>
        {current === 'members' ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-sm text-white/85">Lưu STK để bạn bè quét QR trả tiền</p>
            <a href="#add-member" className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand-600">
              ＋ Thêm
            </a>
          </div>
        ) : (
          <div className="glass mt-3 px-4 py-3">
            <p className="text-xs text-white/85">Tổng chi tiêu · {data.members.length} người</p>
            <p className="text-2xl font-bold tracking-tight">{formatVnd(sum.total)}</p>
            {current === 'balances' && (
              <div className="mt-2">
                <ShareImage groupId={id} groupName={data.group.name} />
              </div>
            )}
          </div>
        )}
      </header>
      <div className="px-4 pt-4">
        {current === 'members' && <MembersTab data={data} />}
        {current === 'balances' && <BalancesTab data={data} sum={sum} />}
        {current === 'expenses' && <ExpensesTab data={data} />}
      </div>
      <nav
        aria-label="Chuyển tab"
        className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t border-brand-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-line-dark dark:bg-field-dark/95"
      >
        <div className="grid grid-cols-3">
          {TABS.map(([key, label, icon]) => (
            <Link
              key={key}
              href={groupPath(id, key)}
              aria-current={current === key ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${current === key ? 'font-bold text-brand-600 dark:text-brand-300' : 'text-gray-400 dark:text-brand-300/50'}`}
            >
              <span aria-hidden className="text-lg leading-none">
                {icon}
              </span>
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
```

In `BalancesTab` delete the line `<ShareImage groupId={id} groupName={data.group.name} />`.

- [ ] **Step 2: `app/g/[id]/copy-link.tsx`** — `idle: '🔗 Copy link'` → `idle: '🔗 Mời'`; keep `className="btn-ghost shrink-0"` (now translucent on the hero).

- [ ] **Step 3: `app/g/[id]/share-image.tsx`** — button `className="btn w-full"` → `className="rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-700 hover:bg-brand-50 disabled:opacity-60"`.

- [ ] **Step 4: Verify**

`npx tsc --noEmit && npm run lint && npx vitest run lib` → pass.
Screenshots for all 3 tabs of `/g/8CCsERCZcromxgLsub048A` at 375 light/dark and 1280 light. Expected: gradient hero; glass total card on Khoản chi/Số dư; share pill only on Số dư; Members hero says "Thành viên" + "＋ Thêm"; bottom bar fixed, active tab violet, centred under the 512px column at 1280. Scroll to the bottom at 375×667: last card fully visible above the bar (Review Focus 1, 5).

- [ ] **Step 5: Commit**

```bash
git add 'app/g/[id]/page.tsx' 'app/g/[id]/copy-link.tsx' 'app/g/[id]/share-image.tsx'
git commit -m "feat(ui): gradient hero header and bottom tab bar on group page"
```

---

### Task 3: Expenses tab

**Files:**
- Modify: `app/g/[id]/page.tsx` (`ExpensesTab`)

**Interfaces:**
- Consumes: `.card`, `.muted`, brand/accent colors.

- [ ] **Step 1: Replace `ExpensesTab`**

```tsx
function ExpensesTab({ data }: { data: GroupData }) {
  const id = data.group.id;
  const name = new Map(data.members.map((m) => [m.id, m.name]));
  return (
    <div className="space-y-3">
      {data.expenses.length === 0 && (
        <div className="card space-y-2 py-10 text-center">
          <div className="text-4xl">🧾</div>
          <p className="font-bold">Chưa có khoản chi nào</p>
          <p className="muted text-sm">Bấm “+” để ghi khoản đầu tiên, ví dụ tiền ăn hay tiền phòng.</p>
        </div>
      )}
      {data.expenses.map((e) =>
        isPayment(e) ? (
          <div key={e.id} className="muted flex items-center gap-3 px-2 py-1 text-sm">
            <span aria-hidden>↔</span>
            <span className="min-w-0 flex-1 truncate">
              {name.get(e.payerId)} đã trả {name.get(e.splits[0].memberId)} · {formatDateVn(e.createdAt)}
            </span>
            <span>{formatVnd(e.amount)}</span>
            <DeleteButton action={deleteExpense.bind(null, id, e.id)} confirmText="Xoá khoản thanh toán này?" />
          </div>
        ) : (
          <div key={e.id} className="card flex items-center gap-3">
            <Avatar id={e.payerId} name={name.get(e.payerId)!} />
            <Link href={expensePath(id, e.id)} className="min-w-0 flex-1">
              <div className="truncate font-bold">{e.title}</div>
              <div className="truncate text-xs text-brand-500 dark:text-brand-300/80">
                {name.get(e.payerId)} trả · {formatDateVn(e.createdAt)}
              </div>
            </Link>
            <div className="font-bold">{formatVnd(e.amount)}</div>
            <DeleteButton action={deleteExpense.bind(null, id, e.id)} confirmText={`Xoá "${e.title}"?`} />
          </div>
        ),
      )}
      <Link
        href={expensePath(id, 'new')}
        aria-label="Thêm khoản chi"
        className="fixed right-[max(1rem,calc((100vw-32rem)/2+1rem))] bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-brand-600 to-accent-600 text-3xl text-white shadow-[0_10px_24px_rgba(219,39,119,0.4)] hover:brightness-110"
      >
        +
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

`npx tsc --noEmit && npm run lint && npx vitest run lib` → pass.
Screenshots: Khoản chi at 375 light/dark, 1280 light; also an empty group (create one). Expected: FAB gradient rounded-square right above the tab bar, inside the 512px column at 1280; last card not hidden; payment row muted (Review Focus 1, 2, 5).

- [ ] **Step 3: Commit**

```bash
git add 'app/g/[id]/page.tsx'
git commit -m "feat(ui): restyle expenses tab and gradient add button"
```

---

### Task 4: Balances tab

**Files:**
- Modify: `app/g/[id]/submit-button.tsx` (optional `className`), `app/g/[id]/page.tsx` (`BalancesTab`, `balanceClass`)

**Interfaces:**
- Produces: `SubmitButton({ children, className = 'btn' })`.

- [ ] **Step 1: `app/g/[id]/submit-button.tsx`**

```tsx
'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton({ children, className = 'btn' }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={className}>
      {children}
    </button>
  );
}
```

- [ ] **Step 2: `balanceClass` colors** — positive `'text-brand-600 dark:text-brand-300'`, negative `'text-accent-600 dark:text-accent-500'`.

- [ ] **Step 3: Replace `BalancesTab`**

```tsx
async function BalancesTab({ data, sum }: { data: GroupData; sum: Summary }) {
  const id = data.group.id;
  const name = new Map(data.members.map((m) => [m.id, m.name]));
  const qrs = await transferQrs(data.group.name, sum.transfers);
  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        {sum.rows.map(({ member: m, balance: v }) => (
          <div key={m.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <Avatar id={m.id} name={m.name} size="sm" />
              <span className="flex-1 truncate">{m.name}</span>
              <span className={`font-bold ${balanceClass(v)}`}>
                {v > 0 ? '+' : ''}
                {formatVnd(v)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-brand-50 dark:bg-line-dark">
              <div
                className={`h-full rounded-full ${v >= 0 ? 'bg-brand-500' : 'bg-accent-500'}`}
                style={{ width: `${(Math.abs(v) / sum.maxAbs) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <h2 className="font-bold">Ai trả ai</h2>
      {sum.transfers.length === 0 && <p className="muted">Mọi người đã cân bằng 🎉</p>}
      {sum.transfers.map((t, i) => {
        const from = name.get(t.from)!;
        const to = name.get(t.to)!;
        const qr = t.account ? qrs[i] : undefined;
        return (
          <div key={`${t.from}-${t.to}`} className="card space-y-3">
            <div className="flex items-center gap-3">
              <Avatar id={t.from} name={from} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{from}</div>
                <div className="truncate text-xs text-brand-500 dark:text-brand-300/80">trả cho {to}</div>
              </div>
              <div className="text-lg font-bold text-accent-600 dark:text-accent-500">{formatVnd(t.amount)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {qr && t.account && (
                <details className="group open:col-span-2">
                  <summary className="btn-soft w-full cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">Quét QR</span>
                    <span className="hidden group-open:inline">Ẩn QR</span>
                  </summary>
                  <div className="mt-3 flex flex-col items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- data URI, nothing to optimize */}
                    <img src={qr} alt={`QR chuyển ${formatVnd(t.amount)} cho ${to}`} className="size-56 rounded-2xl bg-white p-2" />
                    <p className="text-sm">
                      {t.account.bank.name} · {t.account.accountNo}
                    </p>
                    <p className="muted text-xs">Mở app ngân hàng → Quét QR</p>
                    <p className="text-center text-xs text-amber-700 dark:text-amber-400">
                      ⚠️ Kiểm tra đúng tên {to} trên app ngân hàng trước khi chuyển. Ai có link nhóm đều sửa được STK.
                    </p>
                  </div>
                </details>
              )}
              <div className={qr ? '[details[open]+&]:col-span-2' : 'col-span-2'}>
                <ConfirmForm
                  action={recordPayment.bind(null, id, t.from, t.to, t.amount)}
                  confirmText={`Xác nhận ${from} đã trả ${to} ${formatVnd(t.amount)}?`}
                >
                  <SubmitButton className="btn w-full">Đã trả</SubmitButton>
                </ConfirmForm>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Verify**

`npx tsc --noEmit && npm run lint && npx vitest run lib` → pass.
Screenshots of Số dư at 375 light/dark: QR closed (two equal pills), QR open (QR full width, "Ẩn QR" pill full width, "Đã trả" full width below — Review Focus 3); a transfer without account shows one full-width "Đã trả". Confirm dialog still appears (dismiss it).

- [ ] **Step 5: Commit**

```bash
git add 'app/g/[id]/submit-button.tsx' 'app/g/[id]/page.tsx'
git commit -m "feat(ui): restyle balances tab with QR and paid pills"
```

---

### Task 5: Members tab

**Files:**
- Modify: `app/g/[id]/page.tsx` (`MembersTab`)

- [ ] **Step 1: Replace `MembersTab`**

```tsx
function MembersTab({ data }: { data: GroupData }) {
  const id = data.group.id;
  const used = new Set(data.expenses.flatMap((e) => [e.payerId, ...e.splits.map((s) => s.memberId)]));
  const minReached = data.members.length <= 2;
  return (
    <div className="space-y-3">
      {data.members.map((m) => {
        const hint = deleteHint(used.has(m.id), minReached);
        const bank = bankByBin(m.bankBin);
        return (
          <details key={m.id} className="card group open:ring-2 open:ring-brand-300 dark:open:ring-brand-700">
            <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
              <Avatar id={m.id} name={m.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{m.name}</div>
                {bank && m.accountNo ? (
                  <div className="truncate text-xs text-emerald-600 dark:text-emerald-400">
                    🏦 {bank.name} · {m.accountNo}
                  </div>
                ) : (
                  <div className="muted text-xs">Chưa có STK</div>
                )}
              </div>
              <span className="link text-sm">
                <span className="group-open:hidden">Sửa</span>
                <span className="hidden group-open:inline">Đóng</span>
              </span>
            </summary>
            <MemberEditForm action={updateMember.bind(null, id, m.id)} member={m} />
            <form action={deleteMember.bind(null, id, m.id)} className="mt-2 flex items-center justify-end gap-2">
              {hint && <span className="muted text-xs">{hint}</span>}
              <button disabled={!!hint} className="text-sm text-red-600 disabled:text-gray-300 dark:text-red-400 dark:disabled:text-gray-600">
                Xoá thành viên
              </button>
            </form>
          </details>
        );
      })}
      <div id="add-member" className="card scroll-mt-4 space-y-2">
        <p className="text-sm font-bold">Thêm thành viên</p>
        <MemberNameForm action={addMember.bind(null, id)} placeholder="Tên thành viên mới" label="Thêm" buttonClass="btn shrink-0" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

`npx tsc --noEmit && npm run lint && npx vitest run lib` → pass.
Screenshots of Thành viên at 375 light/dark with one card open: violet ring, "Đóng" label, inputs/select readable in dark. Tap hero "＋ Thêm" → scrolls to the add card. Save a bank account → green "🏦 …" line.

- [ ] **Step 3: Commit**

```bash
git add 'app/g/[id]/page.tsx'
git commit -m "feat(ui): restyle members tab"
```

---

### Task 6: Expense form

**Files:**
- Modify: `app/g/[id]/expense/expense-form.tsx`

- [ ] **Step 1: Split-type selector** — replace the selector container and button classes:
  - container `className="grid grid-cols-3 rounded-lg bg-gray-200 dark:bg-gray-800 p-1 text-center text-sm"` → `className="grid grid-cols-3 gap-1 rounded-full bg-brand-50 p-1 text-center text-sm dark:bg-field-dark"`
  - button `` className={`rounded-md py-1.5 ${splitType === t ? 'bg-white font-medium text-emerald-700 shadow-sm dark:bg-gray-900 dark:text-emerald-400' : 'muted'}`} `` → `` className={`rounded-full py-2 ${splitType === t ? 'bg-linear-to-r from-brand-600 to-accent-600 font-bold text-white shadow' : 'muted'}`} ``
- [ ] **Step 2: Details** — checkbox `className="size-5"` → `className="size-5 accent-brand-600"`; the error paragraph `{error && <p className="text-sm text-red-600">` → `className="text-sm text-red-600 dark:text-red-400"`.

- [ ] **Step 3: Verify**

`npx tsc --noEmit && npm run lint && npx vitest run lib` → pass. Screenshot `/g/8CCsERCZcromxgLsub048A/expense/new` at 375 light/dark; switch to "Theo số tiền" → active pill gradient. Save a test expense → returns to group page.

- [ ] **Step 4: Commit**

```bash
git add 'app/g/[id]/expense/expense-form.tsx'
git commit -m "feat(ui): restyle expense form"
```

---

### Task 7: Summary PNG palette

**Files:**
- Modify: `app/g/[id]/summary.png/route.tsx`

- [ ] **Step 1: Colors** — replace `const GREEN = '#059669';` and `const RED = '#dc2626';` with:

```ts
const BRAND = '#7c3aed';
const ACCENT = '#db2777';
const HERO = 'linear-gradient(135deg, #6d28d9, #a21caf 60%, #ec4899)';
```

In `balanceColor`: `GREEN` → `BRAND`, `RED` → `ACCENT`. Transfer amount `color: GREEN` → `color: ACCENT`. Root style `background: '#f9fafb', color: '#111827'` → `background: '#f7f5ff', color: '#1e1b4b'`.

- [ ] **Step 2: Header panel** — replace the group-name div and the "N người · Tổng chi" div with one panel:

```tsx
        <div style={{ display: 'flex', flexShrink: 0, flexDirection: 'column', padding: '32px 36px', borderRadius: 32, backgroundImage: HERO, color: '#fff' }}>
          <div style={{ ...ONE_LINE, display: 'flex', fontSize: 56, fontWeight: 700 }}>{data.group.name}</div>
          <div style={{ display: 'flex', marginTop: 8, color: 'rgba(255,255,255,0.85)' }}>
            {`${data.members.length} người · Tổng chi ${formatVnd(sum.total)} · ${formatDateVn(new Date())}`}
          </div>
        </div>
```

Height base `400 +` → `464 +` (panel adds 2×32px padding).

- [ ] **Step 3: Verify**

`npx tsc --noEmit && npm run lint && npx vitest run lib` → pass. Fetch `/g/8CCsERCZcromxgLsub048A/summary.png` and `/g/TQYnO5LxiH_ZwXVu3NX8QA/summary.png` from the dev server and view them: gradient header, violet/pink amounts, nothing clipped, small empty margin at the bottom only.

- [ ] **Step 4: Commit**

```bash
git add 'app/g/[id]/summary.png/route.tsx'
git commit -m "feat(ui): summary image in the new palette"
```

---

### Task 8: Final verification and local redeploy

- [ ] **Step 1:** `npx tsc --noEmit && npm run lint && npx vitest run lib` → pass.
- [ ] **Step 2: Build** in the existing worktree `/Users/xuanchien/.claude/jobs/14c795f3/tmp/localdeploy`: stop its `next start -p 3001`, `git -C <wt> checkout --detach <HEAD of feat/fintech-ui>`, `npm ci --prefer-offline`, `npm run build` → exit 0.
- [ ] **Step 3: Restart** `npx next start -p 3001 -H 0.0.0.0` from the worktree (background); `curl` `/` → 200 and `/g/8CCsERCZcromxgLsub048A/summary.png` → `200 image/png`.
- [ ] **Step 4:** Final screenshot pass (all screens, 375 light/dark + 1280) against `screens-b.html`; fix any drift in a follow-up commit `fix(ui): …`.

# Summary Image, VietQR, UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members can store a bank account, each settle-up transfer shows a VietQR code, the Balances tab exports a PNG summary to share, and the UI gets a polish pass with dark mode.

**Architecture:** Pure libs (`lib/vietqr.ts`, `lib/banks.ts`, `lib/summary.ts`, `lib/avatar.ts`, `lib/qr.ts`) hold all logic and are unit-tested. Server components render QR as SVG data URIs (no client JS). A `GET` route handler at `/g/[id]/summary.png` renders the summary with `next/og` `ImageResponse`. One small client component handles share/download.

**Tech Stack:** Next.js 16.4 (App Router, `cacheComponents: true`), React 19, Drizzle + Postgres, Tailwind v4, zod 4, Vitest, new dep `qrcode@1.5.4` (+ `@types/qrcode`).

**Spec:** `docs/superpowers/specs/2026-10-12-share-qr-ui-design.md`

## Global Constraints

- Read `node_modules/next/dist/docs/` before using a Next API you are unsure of (AGENTS.md: this Next has breaking changes).
- `cacheComponents: true` → `export const dynamic`/`revalidate` are NOT allowed. Use `await connection()` from `next/server` to force per-request rendering.
- `ImageResponse` from `next/og`: fonts must be `ttf`/`otf`/`woff` (no woff2); only flexbox layout; every `<div>` with more than one child needs `display: 'flex'`.
- No emoji and no `→` in the PNG (fonts lack the glyphs; Satori would fetch fallbacks from the network). Use words ("trả" = pays).
- Only new runtime dependency: `qrcode`. No icon library, no animation library.
- VietQR note: diacritics removed, only `[A-Za-z0-9 ]`, max 25 chars, text `QuickSplit <group name>`.
- Account number: 6–19 digits after stripping spaces, dots, dashes. Bank and account: both set or both empty.
- All UI copy in Vietnamese. Mobile-first (375px), works on desktop. Dark mode via system preference (Tailwind v4 default `dark:` = `prefers-color-scheme`).
- Payment entries are identified by `isPayment(e)` from `lib/summary.ts` (title `Thanh toán`, `exact`, one split). Use it everywhere; no other string compares.
- Never `git add` the untracked `.agents/`, `.claude/`, `AGENTS.md`, `CLAUDE.md`, `skills-lock.json`.

## Review Focus

1. **iOS Safari share after an `await fetch`** loses user activation → `navigator.share` throws `NotAllowedError`. Expected: button keeps the fetched file and shows "Bấm lại để chia sẻ" (Tap again to share); the next tap shares instantly. (Task 6, `share-image.tsx`)
2. **Group name with diacritics/emoji/symbols only** (e.g. `🎉🎉`, `Đà Lạt!!!`) → QR note becomes `QuickSplit` / `QuickSplit Da Lat`, never invalid; download filename falls back to `quick-split-nhom.png`. (Task 1 tests, Task 6 `fileName`)
3. **Account typed with spaces/dots** (`0123 456.789`) → saved as `0123456789`; letters → Vietnamese error, form keeps typed values. (Task 4 tests)
4. **Many members/transfers** (e.g. 20 members, 19 transfers with QR) → PNG height grows, nothing clipped. (Task 6 manual check with a seeded group)
5. **Fonts missing in the deployed bundle** → PNG route 500 on Vercel. Expected: build trace includes `assets/fonts/*`. (Task 6 step checks `.nft.json`)

---

### Task 1: VietQR payload + bank list

**Files:**
- Create: `lib/banks.ts`, `lib/vietqr.ts`
- Test: `lib/vietqr.test.ts`

**Interfaces:**
- Produces: `type Bank = { bin: string; code: string; name: string }`, `BANKS: Bank[]`, `bankByBin(bin: string | null | undefined): Bank | undefined`, `crc16(s: string): string`, `qrNote(s: string): string`, `vietQrPayload(p: { bin: string; accountNo: string; amount: number; note: string }): string`

- [ ] **Step 1: Write the failing test** — `lib/vietqr.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { BANKS, bankByBin } from './banks';
import { crc16, qrNote, vietQrPayload } from './vietqr';

describe('crc16', () => {
  it('matches the CRC-16/CCITT-FALSE check value', () => expect(crc16('123456789')).toBe('29B1'));
});

describe('vietQrPayload', () => {
  // fixture from github.com/xuannghia/vietnam-qr-pay test/test-quick-gen-qr.spec.ts (CRC re-verified)
  it('matches a known-good dynamic VietQR', () => {
    expect(vietQrPayload({ bin: '970416', accountNo: '257678859', amount: 10000, note: 'Chuyen tien' })).toBe(
      '00020101021238530010A0000007270123000697041601092576788590208QRIBFTTA53037045405100005802VN62150811Chuyen tien630453E6',
    );
  });
  it('omits tag 62 when the note sanitizes to empty', () => {
    const p = vietQrPayload({ bin: '970416', accountNo: '257678859', amount: 10000, note: '🎉!!' });
    expect(p).not.toContain('6215');
    expect(p).toMatch(/5802VN6304[0-9A-F]{4}$/);
  });
});

describe('qrNote', () => {
  it('strips diacritics and đ', () => expect(qrNote('QuickSplit Đà Lạt')).toBe('QuickSplit Da Lat'));
  it('drops symbols and emoji, collapses spaces', () => expect(qrNote('Ăn  tối 🎉 #1!')).toBe('An toi 1'));
  it('caps at 25 chars without trailing space', () => {
    const n = qrNote('QuickSplit Chuyen di choi Nha Trang');
    expect(n.length).toBeLessThanOrEqual(25);
    expect(n).toBe('QuickSplit Chuyen di choi');
  });
});

describe('banks', () => {
  it('has unique 6-digit BINs', () => {
    expect(BANKS.every((b) => /^\d{6}$/.test(b.bin))).toBe(true);
    expect(new Set(BANKS.map((b) => b.bin)).size).toBe(BANKS.length);
  });
  it('looks up by bin', () => {
    expect(bankByBin('970437')?.code).toBe('HDBank');
    expect(bankByBin('000000')).toBeUndefined();
    expect(bankByBin(null)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/vietqr.test.ts`
Expected: FAIL — cannot resolve `./banks` / `./vietqr`.

- [ ] **Step 3: Write `lib/banks.ts`** (BINs from https://api.vietqr.io/v2/banks, fetched 2026-10-12)

```ts
export type Bank = { bin: string; code: string; name: string };

// NAPAS BINs, source: https://api.vietqr.io/v2/banks
export const BANKS: Bank[] = [
  { bin: '970436', code: 'Vietcombank', name: 'Vietcombank' },
  { bin: '970415', code: 'VietinBank', name: 'VietinBank' },
  { bin: '970418', code: 'BIDV', name: 'BIDV' },
  { bin: '970405', code: 'Agribank', name: 'Agribank' },
  { bin: '970422', code: 'MBBank', name: 'MB Bank' },
  { bin: '970407', code: 'Techcombank', name: 'Techcombank' },
  { bin: '970416', code: 'ACB', name: 'ACB' },
  { bin: '970432', code: 'VPBank', name: 'VPBank' },
  { bin: '970423', code: 'TPBank', name: 'TPBank' },
  { bin: '970403', code: 'Sacombank', name: 'Sacombank' },
  { bin: '970437', code: 'HDBank', name: 'HDBank' },
  { bin: '970441', code: 'VIB', name: 'VIB' },
  { bin: '970443', code: 'SHB', name: 'SHB' },
  { bin: '970431', code: 'Eximbank', name: 'Eximbank' },
  { bin: '970426', code: 'MSB', name: 'MSB' },
  { bin: '970448', code: 'OCB', name: 'OCB' },
  { bin: '970440', code: 'SeABank', name: 'SeABank' },
  { bin: '970449', code: 'LPBank', name: 'LPBank' },
  { bin: '970428', code: 'NamABank', name: 'Nam A Bank' },
  { bin: '970409', code: 'BacABank', name: 'Bac A Bank' },
  { bin: '546034', code: 'CAKE', name: 'Cake by VPBank' },
  { bin: '963388', code: 'Timo', name: 'Timo' },
];

export const bankByBin = (bin: string | null | undefined) => BANKS.find((b) => b.bin === bin);
```

- [ ] **Step 4: Write `lib/vietqr.ts`**

```ts
// VietQR = EMVCo merchant-presented QR, NAPAS profile. Each field is tag(2) + length(2) + value.
const tlv = (tag: string, value: string) => tag + String(value.length).padStart(2, '0') + value;

// CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF
export function crc16(s: string): string {
  let c = 0xffff;
  for (const b of new TextEncoder().encode(s)) {
    c ^= b << 8;
    for (let i = 0; i < 8; i++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
  }
  return c.toString(16).toUpperCase().padStart(4, '0');
}

// bank apps reject notes with diacritics/symbols or longer than 25 chars
export function qrNote(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 25)
    .trim();
}

export function vietQrPayload(p: { bin: string; accountNo: string; amount: number; note: string }): string {
  const account = tlv('00', 'A000000727') + tlv('01', tlv('00', p.bin) + tlv('01', p.accountNo)) + tlv('02', 'QRIBFTTA');
  const note = qrNote(p.note);
  const body =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('38', account) +
    tlv('53', '704') +
    tlv('54', String(p.amount)) +
    tlv('58', 'VN') +
    (note ? tlv('62', tlv('08', note)) : '') +
    '6304';
  return body + crc16(body);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/vietqr.test.ts`
Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
git add lib/banks.ts lib/vietqr.ts lib/vietqr.test.ts
git commit -m "feat: VietQR payload builder and NAPAS bank list"
```

---

### Task 2: Summary + avatar helpers

**Files:**
- Create: `lib/summary.ts`, `lib/avatar.ts`
- Modify: `app/actions.ts` (use `PAYMENT_TITLE`)
- Test: `lib/summary.test.ts`

**Interfaces:**
- Consumes: `balances`, `settle`, `ExpenseLike`, `Transfer` from `lib/split.ts`; `Bank`, `bankByBin` from Task 1.
- Produces:
  - `PAYMENT_TITLE = 'Thanh toán'`, `isPayment(e: { title: string; splitType: SplitType; splits: Split[] }): boolean`
  - `type SummaryMember = { id: number; name: string; bankBin?: string | null; accountNo?: string | null }`
  - `type SummaryTransfer = Transfer & { account?: { bank: Bank; accountNo: string } }`
  - `type Summary = { total: number; maxAbs: number; rows: { member: SummaryMember; balance: number }[]; transfers: SummaryTransfer[] }`
  - `summarize(data: { members: SummaryMember[]; expenses: (ExpenseLike & { title: string })[] }): Summary`
  - `AVATAR_COLORS: string[]` (hex), `avatarColor(id: number): string`, `initial(name: string): string`

- [ ] **Step 1: Write the failing test** — `lib/summary.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { AVATAR_COLORS, avatarColor, initial } from './avatar';
import { isPayment, PAYMENT_TITLE, summarize } from './summary';

const members = [
  { id: 1, name: 'An', bankBin: '970437', accountNo: '123456789' },
  { id: 2, name: 'Bình', bankBin: null, accountNo: null },
];
const dinner = { title: 'Ăn tối', amount: 300, payerId: 1, splitType: 'equal' as const, splits: [{ memberId: 1, value: 1 }, { memberId: 2, value: 1 }] };
const payment = { title: PAYMENT_TITLE, amount: 50, payerId: 2, splitType: 'exact' as const, splits: [{ memberId: 1, value: 50 }] };

describe('summarize', () => {
  it('totals spending excluding payments, rows follow member order', () => {
    const s = summarize({ members, expenses: [dinner, payment] });
    expect(s.total).toBe(300);
    expect(s.rows.map((r) => [r.member.id, r.balance])).toEqual([[1, 100], [2, -100]]);
    expect(s.maxAbs).toBe(100);
  });
  it('attaches the receiver bank account to transfers', () => {
    const [t] = summarize({ members, expenses: [dinner] }).transfers;
    expect(t).toMatchObject({ from: 2, to: 1, amount: 150, account: { accountNo: '123456789', bank: { code: 'HDBank' } } });
  });
  it('no account when receiver has none or an unknown bin', () => {
    const flipped = { ...dinner, payerId: 2 };
    expect(summarize({ members, expenses: [flipped] }).transfers[0].account).toBeUndefined();
    const bad = [{ ...members[0], bankBin: '000000' }, members[1]];
    expect(summarize({ members: bad, expenses: [dinner] }).transfers[0].account).toBeUndefined();
  });
  it('maxAbs is at least 1 when everyone is even', () => {
    expect(summarize({ members, expenses: [] }).maxAbs).toBe(1);
  });
});

describe('isPayment', () => {
  it('only matches the recorded-payment shape', () => {
    expect(isPayment(payment)).toBe(true);
    expect(isPayment({ ...payment, splitType: 'equal' })).toBe(false);
    expect(isPayment(dinner)).toBe(false);
  });
});

describe('avatar', () => {
  it('initial is uppercase first letter, ? when empty', () => {
    expect(initial('  đức')).toBe('Đ');
    expect(initial('')).toBe('?');
  });
  it('color is stable and from the palette', () => {
    expect(avatarColor(7)).toBe(avatarColor(7));
    expect(AVATAR_COLORS).toContain(avatarColor(123));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/summary.test.ts`
Expected: FAIL — cannot resolve `./avatar` / `./summary`.

- [ ] **Step 3: Write `lib/avatar.ts`**

```ts
// hex (not Tailwind classes) so the PNG route can use the same colors
export const AVATAR_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#f43f5e', '#8b5cf6', '#14b8a6', '#f97316', '#6366f1'];

export const avatarColor = (id: number) => AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];

export const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase();
```

- [ ] **Step 4: Write `lib/summary.ts`**

```ts
import { type Bank, bankByBin } from './banks';
import { balances, type ExpenseLike, settle, type Split, type SplitType, type Transfer } from './split';

export const PAYMENT_TITLE = 'Thanh toán';

export const isPayment = (e: { title: string; splitType: SplitType; splits: Split[] }) =>
  e.title === PAYMENT_TITLE && e.splitType === 'exact' && e.splits.length === 1;

export type SummaryMember = { id: number; name: string; bankBin?: string | null; accountNo?: string | null };
export type SummaryTransfer = Transfer & { account?: { bank: Bank; accountNo: string } };
export type Summary = {
  total: number;
  maxAbs: number;
  rows: { member: SummaryMember; balance: number }[];
  transfers: SummaryTransfer[];
};

export function summarize(data: { members: SummaryMember[]; expenses: (ExpenseLike & { title: string })[] }): Summary {
  const bal = balances(data.expenses);
  const byId = new Map(data.members.map((m) => [m.id, m]));
  const rows = data.members.map((m) => ({ member: m, balance: bal.get(m.id) ?? 0 }));
  const transfers = settle(bal).map((t): SummaryTransfer => {
    const to = byId.get(t.to);
    const bank = bankByBin(to?.bankBin);
    return bank && to?.accountNo ? { ...t, account: { bank, accountNo: to.accountNo } } : t;
  });
  return {
    total: data.expenses.filter((e) => !isPayment(e)).reduce((a, e) => a + e.amount, 0),
    maxAbs: Math.max(1, ...rows.map((r) => Math.abs(r.balance))),
    rows,
    transfers,
  };
}
```

- [ ] **Step 5: Use `PAYMENT_TITLE` in `app/actions.ts`**

Add import `import { PAYMENT_TITLE } from '@/lib/summary';` and in `recordPayment` replace `title: 'Thanh toán',` with `title: PAYMENT_TITLE,`.

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/summary.ts lib/summary.test.ts lib/avatar.ts app/actions.ts
git commit -m "feat: summary and avatar helpers"
```

---

### Task 3: Theme foundation, Avatar, header, sticky tabs

**Files:**
- Modify: `app/globals.css`, `app/layout.tsx`, `app/g/[id]/page.tsx` (header, nav, pass `sum` to tabs), `app/g/[id]/copy-link.tsx`
- Create: `app/g/[id]/avatar.tsx`

**Interfaces:**
- Consumes: `summarize`, `Summary` (Task 2), `avatarColor`, `initial` (Task 2).
- Produces: CSS classes `.muted`, `.btn-ghost` (plus existing `.btn`, `.card`, `.input` now dark-aware); `<Avatar id name size?: 'sm' | 'md' />`; `GroupPage` computes `const sum = summarize(data)` and passes it as `sum` prop to `BalancesTab`.

- [ ] **Step 1: Replace `app/globals.css`**

```css
@import "tailwindcss";

@layer components {
  .input {
    @apply w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-emerald-500 dark:border-gray-700 dark:bg-gray-900;
  }
  .btn {
    @apply rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50;
  }
  .btn-ghost {
    @apply rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800;
  }
  .card {
    @apply rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900;
  }
  .muted {
    @apply text-gray-500 dark:text-gray-400;
  }
}
```

- [ ] **Step 2: Update `app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Quick Split', description: 'Chia tiền nhóm nhanh' };

// native controls (select, scrollbars) follow the system theme
export const viewport: Viewport = { colorScheme: 'light dark' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className="bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <main className="mx-auto max-w-lg p-4">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Create `app/g/[id]/avatar.tsx`**

```tsx
import { avatarColor, initial } from '@/lib/avatar';

export function Avatar({ id, name, size = 'md' }: { id: number; name: string; size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${size === 'sm' ? 'size-7 text-xs' : 'size-9 text-sm'}`}
      style={{ background: avatarColor(id) }}
    >
      {initial(name)}
    </span>
  );
}
```

- [ ] **Step 4: Copy link button style** — in `app/g/[id]/copy-link.tsx` change the `LABEL.idle` value to `'🔗 Copy link'` and the button `className` to `"btn-ghost shrink-0"`.

- [ ] **Step 5: Header + sticky tabs in `app/g/[id]/page.tsx`**

Add imports `import { summarize, type Summary } from '@/lib/summary';`. In `GroupPage`, after `if (!data) notFound();` add `const sum = summarize(data);` and replace the returned JSX's `<header>…</header>` and `<nav>…</nav>` with:

```tsx
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="truncate text-xl font-bold">{data.group.name}</h1>
          <CopyLink />
        </div>
        <p className="muted text-sm">
          {data.members.length} người · Tổng chi {formatVnd(sum.total)}
        </p>
      </header>
      <nav className="sticky top-0 z-10 -mx-4 bg-gray-50/90 px-4 py-2 backdrop-blur dark:bg-gray-950/90">
        <div className="grid grid-cols-3 rounded-lg bg-gray-200 p-1 text-center text-sm dark:bg-gray-800">
          {TABS.map(([key, label]) => (
            <Link
              key={key}
              href={groupPath(id, key)}
              className={`rounded-md py-1.5 ${tab === key ? 'bg-white font-medium text-emerald-700 shadow-sm dark:bg-gray-900 dark:text-emerald-400' : 'muted'}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>
```

Change `{tab === 'balances' && <BalancesTab data={data} />}` to `{tab === 'balances' && <BalancesTab data={data} sum={sum} />}` and the `BalancesTab` signature to `function BalancesTab({ data, sum }: { data: GroupData; sum: Summary })`; inside it replace `const bal = balances(data.expenses);` / `const transfers = settle(bal);` with `const bal = new Map(sum.rows.map((r) => [r.member.id, r.balance]));` / `const transfers = sum.transfers;` (Task 5 rewrites this tab; this keeps it compiling). Remove the now-unused `balances, settle` import. Replace remaining `text-gray-500` in this file with `muted`.

- [ ] **Step 6: Verify**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: all pass. Then `npm run dev`, open a group at 375px wide in light and dark (`prefers-color-scheme` emulation): header shows "N người · Tổng chi …" (N people · Total spent …), tabs stick when scrolling, cards readable in dark.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css app/layout.tsx app/g/[id]/avatar.tsx app/g/[id]/copy-link.tsx app/g/[id]/page.tsx
git commit -m "feat: dark mode, avatar, group header stats and sticky tabs"
```

---

### Task 4: Member bank account

**Files:**
- Modify: `db/schema.ts`, `lib/validation.ts`, `app/actions.ts` (`renameMember` → `updateMember`), `app/g/[id]/page.tsx` (`MembersTab`)
- Create: `app/g/[id]/member-edit-form.tsx`
- Test: `lib/validation.test.ts`

**Interfaces:**
- Consumes: `bankByBin`, `BANKS` (Task 1), `Avatar` (Task 3).
- Produces: columns `members.bankBin: string | null`, `members.accountNo: string | null` (so `GroupData['members'][number]` has them); `memberAccount` zod schema with output `{ bankBin: string; accountNo: string } | { bankBin: null; accountNo: null }`; server action `updateMember(groupId: string, memberId: number, _prev: Result, formData: FormData): Promise<Result>` reading form fields `name`, `bankBin`, `accountNo`.

- [ ] **Step 1: Write the failing test** — append to `lib/validation.test.ts` (and add `memberAccount` to its import list)

```ts
describe('memberAccount', () => {
  const parse = (bankBin: string, accountNo: string) => memberAccount.safeParse({ bankBin, accountNo });
  const msg = (bankBin: string, accountNo: string) => {
    const r = parse(bankBin, accountNo);
    return r.success ? null : firstError(r.error);
  };
  it('both empty clears the account', () => expect(parse('', ' ').data).toEqual({ bankBin: null, accountNo: null }));
  it('strips spaces, dots and dashes', () => {
    expect(parse('970437', '0123 456.78-9').data).toEqual({ bankBin: '970437', accountNo: '0123456789' });
  });
  it('requires both fields', () => {
    expect(msg('970437', '')).toBe('Nhập đủ ngân hàng và số tài khoản');
    expect(msg('', '123456')).toBe('Nhập đủ ngân hàng và số tài khoản');
  });
  it('rejects unknown bank', () => expect(msg('000000', '123456')).toBe('Ngân hàng không hợp lệ'));
  it('rejects letters and wrong length', () => {
    expect(msg('970437', '12345a')).toBe('Số tài khoản gồm 6–19 chữ số');
    expect(msg('970437', '12345')).toBe('Số tài khoản gồm 6–19 chữ số');
    expect(msg('970437', '1'.repeat(20))).toBe('Số tài khoản gồm 6–19 chữ số');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/validation.test.ts`
Expected: FAIL — `memberAccount` is not exported.

- [ ] **Step 3: Add `memberAccount` to `lib/validation.ts`** (add `import { bankByBin } from './banks';` at top; place after `memberName`)

```ts
export const memberAccount = z
  .object({
    bankBin: z.string().trim(),
    accountNo: z.string().transform((s) => s.replace(/[\s.-]/g, '')),
  })
  .superRefine((a, ctx) => {
    if (!a.bankBin && !a.accountNo) return;
    if (!a.bankBin || !a.accountNo) ctx.addIssue({ code: 'custom', message: 'Nhập đủ ngân hàng và số tài khoản' });
    else if (!bankByBin(a.bankBin)) ctx.addIssue({ code: 'custom', message: 'Ngân hàng không hợp lệ' });
    else if (!/^\d{6,19}$/.test(a.accountNo)) ctx.addIssue({ code: 'custom', message: 'Số tài khoản gồm 6–19 chữ số' });
  })
  .transform((a) => (a.bankBin && a.accountNo ? a : { bankBin: null, accountNo: null }));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Schema** — in `db/schema.ts` `members` table add after `name`:

```ts
  bankBin: text('bank_bin'),
  accountNo: text('account_no'),
```

Run: `npm run db:push` (uses `.env.local`). Expected: drizzle-kit adds 2 nullable columns, no data loss prompt.

- [ ] **Step 6: Replace `renameMember` with `updateMember` in `app/actions.ts`** (add `memberAccount` to the `@/lib/validation` import)

```ts
export async function updateMember(groupId: string, memberId: number, _prev: Result, formData: FormData): Promise<Result> {
  const input = {
    name: String(formData.get('name') ?? ''),
    bankBin: String(formData.get('bankBin') ?? ''),
    accountNo: String(formData.get('accountNo') ?? ''),
  };
  const name = memberName.safeParse(input.name);
  if (!name.success) return { error: firstError(name.error), input };
  const account = memberAccount.safeParse(input);
  if (!account.success) return { error: firstError(account.error), input };
  const existing = await groupMembers(groupId);
  if (existing.some((m) => m.id !== memberId && m.name.toLowerCase() === name.data.toLowerCase())) {
    return { error: 'Tên thành viên bị trùng', input };
  }
  await db
    .update(members)
    .set({ name: name.data, ...account.data })
    .where(and(eq(members.id, memberId), eq(members.groupId, groupId)));
  revalidatePath(groupPath(groupId));
  return undefined;
}
```

- [ ] **Step 7: Create `app/g/[id]/member-edit-form.tsx`**

```tsx
'use client';

import { useActionState } from 'react';
import type { Result } from '@/app/actions';
import { BANKS } from '@/lib/banks';

type Member = { name: string; bankBin: string | null; accountNo: string | null };

export function MemberEditForm({ action, member }: { action: (prev: Result, formData: FormData) => Promise<Result>; member: Member }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const v = state?.input;
  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input name="name" defaultValue={v?.name ?? member.name} required maxLength={50} aria-label="Tên" className="input" />
      <div className="flex gap-2">
        <select name="bankBin" defaultValue={v?.bankBin ?? member.bankBin ?? ''} aria-label="Ngân hàng" className="input">
          <option value="">Ngân hàng…</option>
          {BANKS.map((b) => (
            <option key={b.bin} value={b.bin}>
              {b.name}
            </option>
          ))}
        </select>
        <input
          name="accountNo"
          defaultValue={v?.accountNo ?? member.accountNo ?? ''}
          inputMode="numeric"
          maxLength={30}
          placeholder="Số tài khoản"
          aria-label="Số tài khoản"
          className="input"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="btn w-full">
        {pending ? 'Đang lưu…' : 'Lưu'}
      </button>
    </form>
  );
}
```

- [ ] **Step 8: Rewrite `MembersTab` in `app/g/[id]/page.tsx`**

Imports: replace `renameMember` with `updateMember` in the `@/app/actions` import; add `import { bankByBin } from '@/lib/banks';`, `import { Avatar } from './avatar';`, `import { MemberEditForm } from './member-edit-form';`.

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
          <details key={m.id} className="card">
            <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
              <Avatar id={m.id} name={m.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{m.name}</div>
                <div className="muted truncate text-sm">{bank && m.accountNo ? `${bank.name} · ${m.accountNo}` : 'Chưa có STK'}</div>
              </div>
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Sửa</span>
            </summary>
            <MemberEditForm action={updateMember.bind(null, id, m.id)} member={m} />
            <form action={deleteMember.bind(null, id, m.id)} className="mt-2 flex items-center justify-end gap-2">
              {hint && <span className="muted text-xs">{hint}</span>}
              <button disabled={!!hint} className="text-sm text-red-600 disabled:text-gray-300 dark:disabled:text-gray-600">
                Xoá thành viên
              </button>
            </form>
          </details>
        );
      })}
      <div className="card">
        <MemberNameForm action={addMember.bind(null, id)} placeholder="Tên thành viên mới" label="Thêm" buttonClass="btn" />
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Verify**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: pass. In the browser (dev): Members tab → "Sửa" (Edit) → pick HDBank, type `0123 456 789` → "Lưu" (Save) → card shows `HDBank · 0123456789`. Type `12ab` → error "Số tài khoản gồm 6–19 chữ số" (Account number must be 6–19 digits) and the typed value stays. Clear both → "Chưa có STK" (no account yet).

- [ ] **Step 10: Commit**

```bash
git add db/schema.ts lib/validation.ts lib/validation.test.ts app/actions.ts app/g/[id]/member-edit-form.tsx app/g/[id]/page.tsx
git commit -m "feat: optional bank account per member"
```

---

### Task 5: Balances tab with VietQR

**Files:**
- Create: `lib/qr.ts`, `lib/qr.test.ts`
- Modify: `package.json` (dep), `app/g/[id]/delete-button.tsx` (add `ConfirmForm`), `app/g/[id]/page.tsx` (`BalancesTab`)

**Interfaces:**
- Consumes: `vietQrPayload` (Task 1), `Summary`, `SummaryTransfer` (Task 2), `Avatar` (Task 3).
- Produces: `qrDataUri(payload: string): Promise<string>` (`data:image/svg+xml;base64,…`), `transferQrs(groupName: string, transfers: SummaryTransfer[]): Promise<(string | undefined)[]>` (same index as `transfers`), `<ConfirmForm action confirmText>{children}</ConfirmForm>`.

- [ ] **Step 1: Install**

Run: `npm install qrcode@1.5.4 && npm install -D @types/qrcode`

- [ ] **Step 2: Write the failing test** — `lib/qr.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { transferQrs } from './qr';
import { BANKS } from './banks';

const svg = (uri: string) => Buffer.from(uri.replace('data:image/svg+xml;base64,', ''), 'base64').toString();

describe('transferQrs', () => {
  it('returns an SVG data URI only for transfers with an account', async () => {
    const [withAcc, without] = await transferQrs('Đà Lạt', [
      { from: 1, to: 2, amount: 1000, account: { bank: BANKS[0], accountNo: '123456' } },
      { from: 1, to: 3, amount: 500 },
    ]);
    expect(withAcc).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(svg(withAcc!)).toContain('<svg');
    expect(without).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/qr.test.ts`
Expected: FAIL — cannot resolve `./qr`.

- [ ] **Step 4: Write `lib/qr.ts`**

```ts
import QRCode from 'qrcode';
import type { SummaryTransfer } from './summary';
import { vietQrPayload } from './vietqr';

// data URI (not inline SVG) so both <img> and next/og can render it
export async function qrDataUri(payload: string): Promise<string> {
  const svg = await QRCode.toString(payload, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export function transferQrs(groupName: string, transfers: SummaryTransfer[]) {
  return Promise.all(
    transfers.map((t) =>
      t.account
        ? qrDataUri(vietQrPayload({ bin: t.account.bank.bin, accountNo: t.account.accountNo, amount: t.amount, note: `QuickSplit ${groupName}` }))
        : undefined,
    ),
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/qr.test.ts`
Expected: PASS.

- [ ] **Step 6: Add `ConfirmForm` to `app/g/[id]/delete-button.tsx`** (replace file)

```tsx
'use client';

export function ConfirmForm({ action, confirmText, children }: { action: () => Promise<void>; confirmText: string; children: React.ReactNode }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}

export function DeleteButton({ action, confirmText }: { action: () => Promise<void>; confirmText: string }) {
  return (
    <ConfirmForm action={action} confirmText={confirmText}>
      <button className="text-sm text-red-600">Xoá</button>
    </ConfirmForm>
  );
}
```

- [ ] **Step 7: Rewrite `BalancesTab` in `app/g/[id]/page.tsx`**

Imports: add `import { transferQrs } from '@/lib/qr';` and add `ConfirmForm` to the `./delete-button` import.

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
              <span className={`font-medium ${balanceClass(v)}`}>
                {v > 0 ? '+' : ''}
                {formatVnd(v)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className={`h-full rounded-full ${v >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                style={{ width: `${(Math.abs(v) / sum.maxAbs) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <h2 className="font-semibold">Cách trả nợ</h2>
      {sum.transfers.length === 0 && <p className="muted">Mọi người đã cân bằng 🎉</p>}
      {sum.transfers.map((t, i) => {
        const from = name.get(t.from)!;
        const to = name.get(t.to)!;
        return (
          <div key={`${t.from}-${t.to}`} className="card space-y-3">
            <div className="flex items-center gap-2">
              <Avatar id={t.from} name={from} size="sm" />
              <b className="truncate">{from}</b>
              <span className="muted">→</span>
              <Avatar id={t.to} name={to} size="sm" />
              <b className="truncate">{to}</b>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-lg font-bold">{formatVnd(t.amount)}</div>
              <ConfirmForm
                action={recordPayment.bind(null, id, t.from, t.to, t.amount)}
                confirmText={`Xác nhận ${from} đã trả ${to} ${formatVnd(t.amount)}?`}
              >
                <SubmitButton>Đã trả</SubmitButton>
              </ConfirmForm>
            </div>
            {qrs[i] && t.account && (
              <details>
                <summary className="cursor-pointer text-sm font-medium text-emerald-700 dark:text-emerald-400">Hiện QR chuyển khoản</summary>
                <div className="mt-3 flex flex-col items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URI, nothing to optimize */}
                  <img src={qrs[i]} alt={`QR chuyển ${formatVnd(t.amount)} cho ${to}`} className="size-56 rounded-lg bg-white p-2" />
                  <p className="text-sm">
                    {t.account.bank.name} · {t.account.accountNo}
                  </p>
                  <p className="muted text-xs">Mở app ngân hàng → Quét QR</p>
                </div>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

Remove anything in the file that is now unused (e.g. the `bal`/`transfers` lines from Task 3).

- [ ] **Step 8: Verify**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: pass. In dev: give the receiver of a transfer an account (Task 4) → Balances tab shows "Hiện QR chuyển khoản" (Show transfer QR); open it → QR visible on white background in dark mode too. **Scan the QR with a real banking app**: receiver, amount and note `QuickSplit <name>` pre-filled (do not complete the transfer). "Đã trả" (Paid) asks for confirmation; Cancel does nothing.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json lib/qr.ts lib/qr.test.ts app/g/[id]/delete-button.tsx app/g/[id]/page.tsx
git commit -m "feat: VietQR codes and balance bars on the balances tab"
```

---

### Task 6: Summary PNG + share button

**Files:**
- Create: `assets/fonts/BeVietnamPro-Regular.ttf`, `assets/fonts/BeVietnamPro-Bold.ttf`, `assets/fonts/OFL.txt`, `app/g/[id]/summary.png/route.tsx`, `app/g/[id]/share-image.tsx`
- Modify: `lib/routes.ts`, `next.config.ts`, `app/g/[id]/page.tsx` (render `ShareImage` at top of `BalancesTab`)

**Interfaces:**
- Consumes: `getGroup` (`db/queries.ts`), `summarize` (Task 2), `transferQrs` (Task 5), `avatarColor`, `initial` (Task 2), `qrNote` (Task 1), `formatVnd`, `formatDateVn`.
- Produces: `summaryImagePath(id: string): string` → `/g/${id}/summary.png`; `GET /g/[id]/summary.png` → `image/png`, 404 for unknown id; `<ShareImage groupId groupName />`.

- [ ] **Step 1: Fonts**

```bash
mkdir -p assets/fonts
curl -fsSL -o assets/fonts/BeVietnamPro-Regular.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Regular.ttf
curl -fsSL -o assets/fonts/BeVietnamPro-Bold.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Bold.ttf
curl -fsSL -o assets/fonts/OFL.txt https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/OFL.txt
ls -l assets/fonts
```
Expected: Regular ≈ 132,948 bytes, Bold ≈ 140,300 bytes, OFL.txt present.

- [ ] **Step 2: Route helper** — append to `lib/routes.ts`:

```ts
export const summaryImagePath = (groupId: string) => `/g/${groupId}/summary.png`;
```

- [ ] **Step 3: Create `app/g/[id]/summary.png/route.tsx`**

```tsx
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { connection } from 'next/server';
import { getGroup } from '@/db/queries';
import { avatarColor, initial } from '@/lib/avatar';
import { formatDateVn } from '@/lib/date';
import { formatVnd } from '@/lib/money';
import { transferQrs } from '@/lib/qr';
import { summarize } from '@/lib/summary';

const font = (w: string) => readFile(join(process.cwd(), `assets/fonts/BeVietnamPro-${w}.ttf`));
const fonts = Promise.all([font('Regular'), font('Bold')]);

const GREEN = '#059669';
const RED = '#dc2626';
const GRAY = '#6b7280';

function Dot({ id, name }: { id: number; name: string }) {
  return (
    <div
      style={{ display: 'flex', width: 48, height: 48, borderRadius: 24, background: avatarColor(id), color: '#fff', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 24 }}
    >
      {initial(name)}
    </div>
  );
}

// No emoji / arrows here: the bundled font lacks them and Satori would fetch fallbacks over the network.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const data = await getGroup(id);
  if (!data) return new Response('Not found', { status: 404 });
  const sum = summarize(data);
  const qrs = await transferQrs(data.group.name, sum.transfers);
  const name = new Map(data.members.map((m) => [m.id, m.name]));
  const [regular, bold] = await fonts;
  const height =
    330 + sum.rows.length * 64 + (sum.transfers.length ? sum.transfers.reduce((h, _, i) => h + (qrs[i] ? 300 : 120), 0) : 80);

  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: 56, background: '#f9fafb', color: '#111827', fontFamily: 'BeVietnamPro', fontSize: 30 }}>
        <div style={{ display: 'flex', fontSize: 56, fontWeight: 700 }}>{data.group.name}</div>
        <div style={{ display: 'flex', marginTop: 8, color: GRAY }}>
          {`${data.members.length} người · Tổng chi ${formatVnd(sum.total)} · ${formatDateVn(new Date())}`}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 32, padding: '16px 32px', background: '#fff', borderRadius: 24 }}>
          {sum.rows.map(({ member: m, balance: v }) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', height: 64 }}>
              <Dot id={m.id} name={m.name} />
              <div style={{ display: 'flex', flex: 1, marginLeft: 16 }}>{m.name}</div>
              <div style={{ display: 'flex', fontWeight: 700, color: v > 0 ? GREEN : v < 0 ? RED : GRAY }}>{`${v > 0 ? '+' : ''}${formatVnd(v)}`}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', marginTop: 40, fontSize: 40, fontWeight: 700 }}>Cách trả nợ</div>
        {sum.transfers.length === 0 && <div style={{ display: 'flex', marginTop: 16, color: GRAY }}>Mọi người đã cân bằng.</div>}
        {sum.transfers.map((t, i) => (
          <div key={`${t.from}-${t.to}`} style={{ display: 'flex', alignItems: 'center', marginTop: 16, padding: 24, background: '#fff', borderRadius: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex' }}>{`${name.get(t.from)} trả ${name.get(t.to)}`}</div>
              <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, color: GREEN }}>{formatVnd(t.amount)}</div>
              {t.account && <div style={{ display: 'flex', color: GRAY, fontSize: 26 }}>{`${t.account.bank.name} · ${t.account.accountNo}`}</div>}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori only renders <img> */}
            {qrs[i] && <img src={qrs[i]} width={240} height={240} alt="" />}
          </div>
        ))}
      </div>
    ),
    {
      width: 1080,
      height,
      fonts: [
        { name: 'BeVietnamPro', data: regular, weight: 400, style: 'normal' },
        { name: 'BeVietnamPro', data: bold, weight: 700, style: 'normal' },
      ],
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
```

If `tsc` rejects `data: regular` (Buffer vs ArrayBuffer), pass `regular.buffer.slice(regular.byteOffset, regular.byteOffset + regular.byteLength)` (same for `bold`).

- [ ] **Step 4: Make sure the fonts ship** — in `next.config.ts` add inside `nextConfig`:

```ts
  // fonts are read from disk by the summary image route
  outputFileTracingIncludes: { '/g/[id]/summary.png': ['./assets/fonts/*'] },
```

- [ ] **Step 5: Check the route renders**

Run: `npm run dev`, then in another shell:
```bash
curl -s -o /tmp/qs.png -w '%{http_code} %{content_type}\n' http://localhost:3000/g/<existing-group-id>/summary.png
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/g/nope/summary.png
```
Expected: `200 image/png` and `404`. Open `/tmp/qs.png`: Vietnamese diacritics render correctly (e.g. "Bình", "Tổng chi", "Cách trả nợ"), QR shows for receivers with an account, nothing clipped at the bottom. Repeat with a group of 20 members (create via home page) to check height.

- [ ] **Step 6: Create `app/g/[id]/share-image.tsx`**

```tsx
'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { qrNote } from '@/lib/vietqr';
import { summaryImagePath } from '@/lib/routes';

type Status = 'idle' | 'busy' | 'retry' | 'failed';

const probe = () => new File([], 'x.png', { type: 'image/png' });
const noop = () => () => {};

export function ShareImage({ groupId, groupName }: { groupId: string; groupName: string }) {
  // server snapshot false → no hydration mismatch; client re-renders with the real value
  const canShare = useSyncExternalStore(noop, () => !!navigator.canShare?.({ files: [probe()] }), () => false);
  const [status, setStatus] = useState<Status>('idle');
  const file = useRef<File | null>(null);
  const fileName = `quick-split-${qrNote(groupName).toLowerCase().replace(/ /g, '-') || 'nhom'}.png`;

  async function run() {
    setStatus('busy');
    try {
      if (!file.current) {
        const res = await fetch(summaryImagePath(groupId));
        if (!res.ok) throw new Error(String(res.status));
        file.current = new File([await res.blob()], fileName, { type: 'image/png' });
      }
      if (canShare) {
        try {
          await navigator.share({ files: [file.current], title: groupName });
        } catch (e) {
          // iOS: user activation expires during the fetch; the cached file shares on the next tap
          if ((e as Error).name === 'NotAllowedError') return setStatus('retry');
          if ((e as Error).name !== 'AbortError') throw e;
        }
      } else {
        const url = URL.createObjectURL(file.current);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
      file.current = null; // next tap fetches fresh data
      setStatus('idle');
    } catch {
      file.current = null;
      setStatus('failed');
    }
  }

  const label = {
    idle: canShare ? '📤 Chia sẻ ảnh tổng kết' : '⬇️ Tải ảnh tổng kết',
    busy: 'Đang tạo…',
    retry: 'Bấm lại để chia sẻ',
    failed: 'Lỗi, thử lại',
  }[status];

  return (
    <button type="button" onClick={run} disabled={status === 'busy'} className="btn w-full">
      {label}
    </button>
  );
}
```

- [ ] **Step 7: Mount it** — in `app/g/[id]/page.tsx` add `import { ShareImage } from './share-image';` and make `<ShareImage groupId={id} groupName={data.group.name} />` the first child of `BalancesTab`'s outer `<div className="space-y-4">`.

- [ ] **Step 8: Verify**

Run: `npm run lint && npx tsc --noEmit && npm run build`
Expected: pass. Then:
```bash
find .next -path '*summary.png*' -name '*.nft.json' | xargs grep -l BeVietnamPro
```
Expected: one matching file (fonts are traced). If none, check the `outputFileTracingIncludes` key against `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md` and fix.
In dev on desktop Chrome: Balances → "⬇️ Tải ảnh tổng kết" (Download summary image) downloads `quick-split-<name>.png`. With mobile emulation the label may still be "Tải" (Download) (emulation doesn't add `canShare`) — that's fine; real-phone share is a manual check in Task 8.

- [ ] **Step 9: Commit**

```bash
git add assets/fonts lib/routes.ts next.config.ts app/g/[id]/summary.png/route.tsx app/g/[id]/share-image.tsx app/g/[id]/page.tsx
git commit -m "feat: shareable summary image with VietQR codes"
```

---

### Task 7: Expenses tab, home page, expense form polish

**Files:**
- Modify: `app/g/[id]/page.tsx` (`ExpensesTab`), `app/page.tsx`, `app/g/[id]/expense/expense-form.tsx`

**Interfaces:**
- Consumes: `isPayment` (Task 2), `Avatar` (Task 3), `.muted` (Task 3).
- Produces: nothing new.

- [ ] **Step 1: Rewrite `ExpensesTab`** (add `isPayment` to the `@/lib/summary` import)

```tsx
function ExpensesTab({ data }: { data: GroupData }) {
  const id = data.group.id;
  const name = new Map(data.members.map((m) => [m.id, m.name]));
  const add = expensePath(id, 'new');
  return (
    <div className="space-y-3 pb-20 sm:pb-0">
      <Link href={add} className="btn hidden text-center sm:block">
        + Thêm khoản chi
      </Link>
      {data.expenses.length === 0 && (
        <div className="card space-y-2 py-10 text-center">
          <div className="text-4xl">🧾</div>
          <p className="font-medium">Chưa có khoản chi nào</p>
          <p className="muted text-sm">Bấm “+” để ghi khoản đầu tiên, ví dụ tiền ăn hay tiền phòng.</p>
        </div>
      )}
      {data.expenses.map((e) =>
        isPayment(e) ? (
          <div key={e.id} className="muted flex items-center gap-3 px-4 py-1 text-sm">
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
              <div className="truncate font-medium">{e.title}</div>
              <div className="muted text-sm">
                {name.get(e.payerId)} trả · {formatDateVn(e.createdAt)}
              </div>
            </Link>
            <div className="font-semibold">{formatVnd(e.amount)}</div>
            <DeleteButton action={deleteExpense.bind(null, id, e.id)} confirmText={`Xoá "${e.title}"?`} />
          </div>
        ),
      )}
      <Link
        href={add}
        aria-label="Thêm khoản chi"
        className="fixed right-4 bottom-6 z-20 flex size-14 items-center justify-center rounded-full bg-emerald-600 text-3xl text-white shadow-lg hover:bg-emerald-700 sm:hidden"
      >
        +
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Home page** — replace `app/page.tsx`

```tsx
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
```

- [ ] **Step 3: Expense form dark mode** — in `app/g/[id]/expense/expense-form.tsx`:
  - line ~66: `className="text-gray-500"` → `className="muted"`
  - line ~81: `bg-gray-200` → `bg-gray-200 dark:bg-gray-800`
  - line ~87: `'bg-white font-medium shadow-sm' : 'text-gray-600'` → `'bg-white font-medium text-emerald-700 shadow-sm dark:bg-gray-900 dark:text-emerald-400' : 'muted'`
  - line ~126: `text-gray-600` → `muted`
  - line ~131: `'text-gray-600'` → `'muted'`

- [ ] **Step 4: Verify**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: pass. Then `grep -rn "text-gray-[56]00" app` → no matches outside `globals.css`. In dev at 375px: FAB visible bottom-right and does not cover the last expense (bottom padding); at ≥640px the inline button shows and FAB is hidden; empty group shows the 🧾 empty state; a recorded payment shows as a muted "↔ A đã trả B" (A paid B) row; home shows 3 steps. Check light and dark.

- [ ] **Step 5: Commit**

```bash
git add app/g/[id]/page.tsx app/page.tsx app/g/[id]/expense/expense-form.tsx
git commit -m "feat: polish expenses tab, home page and expense form"
```

---

### Task 8: Final verification + README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README** — after the first paragraph add:

```markdown
Sharing: members can save a bank + account number to show a VietQR code (amount pre-filled) on the Balances tab; the "Share/Download summary image" button exports a PNG of balances + settle-up transfers to send via Zalo/Messenger.
```

And in the "Note" line append: ` Saved account numbers are also visible to everyone with the link.`

Under "Deploy" step 2 add: `When upgrading from an older version: rerun this command to add the bank/account columns.`

- [ ] **Step 2: Full check**

Run: `npm test && npm run lint && npm run build`
Expected: all pass, build lists `/g/[id]/summary.png` as a dynamic (ƒ) route.

- [ ] **Step 3: Browser pass** (dev server, 375px and 1280px, light and dark): create group → add expenses → add bank account → Balances QR → "Đã trả" (Paid, confirm) → download image → open PNG. Note anything off and fix before committing.

- [ ] **Step 4: Manual on a real phone (report to user, cannot be automated):** share button opens the native share sheet and the image lands in Zalo; QR scans in a banking app with correct receiver/amount/note.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: README notes for VietQR and summary image"
```

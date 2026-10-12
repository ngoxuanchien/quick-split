# Quick Split — Fintech UI redesign (style B) — Design

Date: 2026-10-12

## Goal

The user finds the current UI plain and not modern. Restyle every screen in a
Vietnamese-fintech look (reference: Cake, MoMo), direction "B" picked from
mockups: violet→pink gradient hero, frosted-glass total card, rounded cards
with soft violet shadows, gradient pill buttons, bottom tab bar like a mobile
app. Data, server actions, QR logic and tests do not change.

Mockups (approved): `.superpowers/brainstorm/88166-1791785202/content/screens-b.html`
(home, expenses, members, balances-dark) and `visual-style.html` option B.

## Scope

In: visual layer of `/`, `/g/[id]` (3 tabs), expense form pages, and the
summary PNG; dark mode (system preference) in the same palette; Be Vietnam
Pro as the web font.

Out: new features, data/schema changes, animation libraries, icon libraries,
new dependencies, manual light/dark toggle.

## Design tokens (`app/globals.css`)

Tailwind v4 `@theme`:
- `--color-brand-50: #f5f3ff` (soft button bg), `--color-brand-100: #ede9fe`,
  `--color-brand-500: #8b5cf6`, `--color-brand-600: #7c3aed`,
  `--color-brand-700: #6d28d9`, `--color-accent-500: #ec4899`,
  `--color-accent-600: #db2777`, `--color-accent-700: #be185d`,
  `--color-canvas: #f7f5ff` (light page bg), `--color-canvas-dark: #0f0b1f`,
  `--color-surface-dark: #1a1430`, `--color-line-dark: #2e2550`.
- `--font-sans` set from the next/font variable `--font-be-vietnam`.

Component classes (`@layer components`):
- `.hero` — `linear-gradient(135deg, #6d28d9, #a21caf 60%, #ec4899)`, white
  text; dark: `linear-gradient(135deg, #4c1d95, #701a75 60%, #9d174d)`.
- `.glass` — `bg-white/15 border border-white/25 backdrop-blur rounded-2xl`
  (dark: `bg-white/8 border-white/18`).
- `.btn` — gradient `#7c3aed → #db2777`, white, `rounded-full`, bold,
  `px-5 py-2.5`, disabled opacity 50%.
- `.btn-soft` — `bg-brand-50 text-brand-700 rounded-full` (dark:
  `bg-[#2a2148] text-violet-300`).
- `.btn-ghost` — kept (copy link etc.), restyled for the hero: translucent
  white circle/pill.
- `.card` — `bg-white rounded-2xl p-4 shadow-[0_4px_14px_rgba(124,58,237,.07)]`
  (dark: `bg-surface-dark border border-line-dark shadow-none`).
- `.input` — `rounded-xl border-[1.5px] border-brand-100 bg-white px-3 py-2.5
  focus:border-brand-500` (dark: `bg-[#140f28] border-line-dark`).
- `.muted` — kept; violet-tinted grays (`text-gray-500`, dark
  `text-violet-300/70`).

Body: `bg-canvas text-[#1e1b4b]`, dark `bg-canvas-dark text-violet-50`.

## Font

`next/font/local` in `app/layout.tsx` loading `assets/fonts/BeVietnamPro-
Regular.ttf` (400) and `-Bold.ttf` (700), `variable: '--font-be-vietnam'`,
`display: 'swap'`. No network font fetch at build or runtime.

## Layout per screen

### Home (`app/page.tsx`, `app/create-group-form.tsx`)
Full-bleed `.hero` with rounded bottom corners (`rounded-b-[30px]`), title
"Quick Split" (3xl, extrabold), tagline "Chia tiền nhóm trong 1 phút. Không
cần đăng nhập.", three step pills (① Tạo nhóm ② Gửi link ③ Quét QR). The
create form card overlaps the hero (`-mt-10`), stronger shadow; submit is
`.btn` full width "Tạo nhóm →".

### Group page (`app/g/[id]/page.tsx`)
- Header: full-bleed `.hero`: group name (lg, extrabold) + round 🔗 copy
  button; inside it a `.glass` card "Tổng chi tiêu · N người" + total
  (2xl extrabold). On the Balances tab the glass card also holds the share
  button (white pill). On the Members tab the hero shows "Thành viên", a
  hint "Lưu STK để bạn bè quét QR trả tiền", and a white "＋ Thêm" pill that
  links to `#add-member` (the add form gets that id).
- Bottom tab bar replaces the top segmented tabs: `fixed bottom-0`, centred
  to `max-w-lg`, white (dark `#140f28`), top border, icons 🧾 / 💜 / 👥 with
  labels, active tab `text-brand-600 font-bold`, padding
  `pb-[env(safe-area-inset-bottom)]`. Page content gets bottom padding so
  nothing hides under it.
- Root layout `main` loses its padding for full-bleed heroes; each page adds
  its own horizontal padding below the hero.

### Expenses tab
Cards as now (avatar, title, "<payer> trả · <date>", amount, Xoá) with the new
`.card`; muted payment rows unchanged in content; FAB becomes a gradient
rounded-square (`rounded-2xl size-14`) sitting above the tab bar, shown on all
widths (the inline desktop add button is removed — tab bar is now the nav on
desktop too). Empty state card restyled.

### Balances tab
Balance bars card kept (bar colors: positive `brand-500`, negative
`accent-500`). Section title "Ai trả ai". Transfer card: avatar + "**Chi**" +
small "trả cho An" (brand), amount right in `accent-600` bold; under it a row
of two equal pills: `[Quét QR]` (`.btn-soft`, the `<details>` summary) and
`[Đã trả]` (`.btn`, confirm kept). Expanded QR: white rounded square, bank ·
account, scan hint, amber warning (kept). If no account: only `[Đã trả]`
full width.

### Members tab
Cards: avatar, name, "🏦 <bank name> · <account>" in emerald or "Chưa có STK"
muted, "Sửa" link in brand. Open card (`details[open]`) gets
`ring-2 ring-brand-300`. Edit form uses new `.input`/`.btn`. Add-member card
at the bottom has `id="add-member"`.

### Expense form (`expense/new`, `expense/[eid]`, `expense-form.tsx`)
Same hero-less page with back link in brand color, form in `.card`, split type
selector as pill segmented control (active = gradient pill), inputs `.input`,
submit `.btn` full width.

## Summary PNG (`app/g/[id]/summary.png/route.tsx`)
Header block becomes a gradient panel (`linear-gradient(135deg, #6d28d9,
#a21caf 60%, #ec4899)`, white text, radius 32) holding group name and the
"N người · Tổng chi · date" line; page bg `#f7f5ff`; transfer amounts
`#db2777`; positive balances `#7c3aed`, negative `#db2777`. Layout heights
unchanged except the header block (re-measure and update the height
constant).

## Error handling
Unchanged; only class names move. Form error text stays red (`text-red-600`,
dark `text-red-400`).

## Testing
- `npx vitest run lib`, `npx tsc --noEmit`, `npm run lint`, build in a
  separate worktree (the user's `npm run start` on :3000 uses `.next`).
- Screenshots at 375px and 1280px, light and dark, of: home, expenses,
  balances (QR open), members (edit open), expense form; compare with the
  mockups. Check the tab bar does not cover the last card or the FAB.
- Render the summary PNG for the QR group and the long-name group.

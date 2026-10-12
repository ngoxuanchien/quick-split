# Quick Split — Summary image, VietQR, UI polish — Design

Date: 2026-10-12

## Goal

Make settling up easier after a trip: members can store a bank account, each
settle-up transfer shows a VietQR code pre-filled with amount and note, and the
Balances tab can export one PNG summary (balances + transfers + QR) to send
into a Zalo/Messenger chat. Polish the existing UI without changing its
structure (3 tabs, same flows).

## Scope

In:
- Optional bank (NAPAS BIN) + account number per member.
- VietQR payload generated in-app (no external API), rendered as SVG.
- Summary PNG route + "Chia sẻ ảnh" / "Tải ảnh" button.
- UI polish: header stats, sticky tabs, letter avatars, FAB, empty states,
  balance bars, member cards, home page steps, dark mode (system preference).

Out: receipt photo upload, external QR services (img.vietqr.io), account
holder name, animations, icon library, toasts, login/privacy for account numbers.

Known trade-off: anyone with the group link sees stored account numbers
(same trust model as the rest of the app; README warns against public links).

## Data model

`members` gets two nullable columns:
- `bank_bin text` — 6-digit NAPAS BIN, must be one of `lib/banks.ts`
- `account_no text` — 6–19 digits

Both set or both null (validated in zod; one without the other is an error;
clearing both removes the account).
Applied with `npm run db:push`.

## Units

- `lib/banks.ts` — `BANKS: { bin, code, name }[]`, ~20 popular banks
  (e.g. VCB 970436, MB 970422, HDBank 970437). BINs verified against the
  official NAPAS list during planning.
- `lib/vietqr.ts` — `vietQrPayload({ bin, accountNo, amount, note }): string`.
  EMVCo TLV: payload format `000201`, point of initiation `010212` (dynamic,
  has amount), merchant account info tag 38 (GUID `A000000727`, BIN +
  account, service `QRIBFTTA`), currency `5303704`, amount tag 54, country
  `5802VN`, note in tag 62 sub-tag 08, CRC16-CCITT (0x1021, init 0xFFFF)
  in tag 63. Note is stripped of diacritics and non `[A-Za-z0-9 ]` chars,
  max 25 chars (bank apps reject otherwise). Unit tests: CRC against a
  known vector, full payload against a known-good sample.
- `lib/qr.ts` — `qrSvg(payload): Promise<string>` via the `qrcode` package
  (only new dependency). Used by the Balances tab and the summary image.
- `lib/summary.ts` — pure `summarize(data: GroupData)` → `{ total, rows:
  {member, balance}[], transfers: {from, to, amount, bank?}[] }`. Shared by
  the Balances tab and the PNG route so both show the same numbers. Unit test.
- `lib/avatar.ts` — `initial(name)` and `avatarColor(id)` (fixed palette
  indexed by id).

## Features

### Bank account (Members tab)

Each member is a card: avatar, name, "<bank code> · <account_no>" or
"Chưa có STK". A `<details>` "Sửa" expands a form with name, bank `<select>`
(+ empty option) and account input. The existing `renameMember` action is
extended to `updateMember` (name + bank fields), validated in
`lib/validation.ts`. Add-member form unchanged.

### VietQR (Balances tab)

Each transfer card: avatar A → avatar B, amount, `[Hiện QR]` (only if B has
an account) and `[Đã trả]` (now with a confirm prompt, reusing the existing
`DeleteButton` confirm pattern). "Hiện QR" is a `<details>` that reveals the
server-rendered SVG plus bank + account text. Note: `QuickSplit <group name>`.

### Summary image

`app/g/[id]/summary.png/route.tsx` — `GET` returns `ImageResponse`
(`next/og`), 1080px wide, height grows with row count. Fresh data per request
(`dynamic = 'force-dynamic'`), 404 for unknown group. Content: group name,
total, export date; balances (green +, red −); "Cách trả nợ" rows with small
QR + bank/account when available; "Mọi người đã cân bằng 🎉" if empty.
Font: Be Vietnam Pro Regular + Bold TTF committed to `assets/fonts/`, read
with `fs` (no runtime font fetch).

`app/g/[id]/share-image.tsx` (client): fetches the PNG as a Blob. If
`navigator.canShare({ files })` → label "Chia sẻ ảnh", opens the native share
sheet; else label "Tải ảnh", downloads `quick-split-<group>.png`. States:
idle / "Đang tạo…" / "Lỗi, thử lại". Placed at top of Balances tab.

### UI polish

- Header: group name + "N người · Tổng chi X"; Copy link becomes icon+text.
- Tabs sticky at top; active tab emerald.
- Avatars in expenses, balances, members.
- Expenses: full-width add button replaced by a FAB (bottom-right) on mobile,
  inline button on wide screens; "Thanh toán" entries styled muted with ↔;
  empty state with icon, hint and add button.
- Balances: per-member horizontal bar (CSS width ∝ |balance| / max).
- Home: 3 short steps (Tạo nhóm → Gửi link → Chia tiền), restyled form.
- Dark mode via `prefers-color-scheme`: `dark:` variants, extending
  existing `.card` / `.btn` / `.input` in `globals.css`.

## Error handling

- Invalid bank/account input → field error via existing `Result` pattern.
- Member with only one of bank/account → validation error.
- PNG route: unknown group → 404; share button shows "Lỗi, thử lại" on fetch
  failure; share sheet cancel (`AbortError`) is ignored silently.

## Testing

- Vitest: `vietqr` (CRC vector + full payload sample + note sanitizing),
  `summary`, bank/account validation, `avatar` color stability.
- `npm test`, `npm run lint`, `npm run build` all pass.
- Manual: run dev, open `/g/<id>/summary.png`, check Vietnamese diacritics
  and QR; scan a generated QR with a real bank app; check 375px and desktop,
  light and dark.

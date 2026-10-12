# Quick Split — Design

Date: 2026-10-12

## Goal

A web app for splitting group expenses quickly. One person creates a group and
shares the link; anyone with the link can add, edit and delete expenses. The app
shows each member's balance and a minimal list of transfers to settle up.

## Scope

In:
- Create group (name + members), share via unguessable link, no login.
- Expenses with 3 split types: equal (among selected), exact amounts, shares.
- Balances + simplified settle-up list + "Đã trả" (record a payment).
- Vietnamese UI, mobile-first, VND only (integer đồng).
- Deploy on Vercel, data in Neon Postgres.

Out: multiple currencies, accounts/login, notifications, receipt images,
edit history, realtime sync (refresh to see others' changes).

## Stack

Next.js (App Router, TypeScript) + Server Actions, Drizzle ORM + Postgres via `pg` (works with Neon in prod and local Docker Postgres in dev),
Tailwind CSS, zod for validation, Vitest for unit tests.

## Data model

- `groups`: `id` (128-bit random base64url string from `crypto.randomBytes(16)`, used in URL), `name`, `created_at`
- `members`: `id` (serial), `group_id` → groups, `name`
- `expenses`: `id` (serial), `group_id` → groups, `title`, `amount` (integer VND, > 0),
  `payer_id` → members, `split_type` (`equal` | `exact` | `shares`), `created_at`
- `expense_splits`: `expense_id` → expenses (cascade delete), `member_id` → members, `value` (integer)
  - `equal`: value = 1 (marks participation)
  - `exact`: value = amount owed by that member
  - `shares`: value = number of shares (> 0)

A settle-up payment from A to B is stored as an expense: `title='Thanh toán'`,
`payer_id=A`, `split_type='exact'`, one split `{B, amount}`. No extra table.

## Split logic (`lib/split.ts`, pure, shared by server and client)

- `computeShares(amount, splitType, splits) → Map<memberId, owed>`
  - equal / shares: `floor(amount * value / totalValue)` per member; the leftover
    đồng are added one each to members in split order, so the sum always equals `amount`.
  - exact: returns values as-is; validation requires `sum(values) === amount`.
- `balances(expenses) → Map<memberId, number>`: paid − owed per member. Sum is always 0.
- `settle(balances) → {from, to, amount}[]`: greedy — repeatedly match the largest
  debtor with the largest creditor, transfer the min of the two, until all zero.
  At most n−1 transfers.

## Routes / UI

- `/` — create group form: group name + member names (one per line, ≥ 2 members).
  On submit → redirect `/g/[id]`.
- `/g/[id]` — group page (Server Component reading DB), header with group name and
  "Copy link" button, three tabs:
  - **Khoản chi**: expenses newest first; each with edit link and delete button.
  - **Số dư**: per-member balance (green = được nhận, red = đang nợ) and settle list
    "A → B: 150.000đ" each with "Đã trả" button that records a payment.
  - **Thành viên**: add member, rename member. A member referenced by any
    expense (as payer or split) cannot be deleted; others can, as long as the group keeps ≥ 2 members.
- `/g/[id]/expense/new`, `/g/[id]/expense/[eid]` — expense form: title, amount, payer,
  split type tabs (equal: checkboxes; exact: amount per member; shares: shares per
  member), live preview of each member's owed amount via `computeShares`.

Money formatted with `Intl.NumberFormat('vi-VN')` + "đ".

## Data flow

Server Actions for all mutations (create group, add/rename/delete member,
create/update/delete expense, record payment), then `revalidatePath('/g/[id]')`.
Reads happen directly in Server Components.

## Validation & errors

- Unknown group id → `notFound()` (404).
- Server Actions validate with zod: amount integer > 0, ≥ 1 participant, every
  member id belongs to the group, exact sum equals amount, shares > 0, non-empty names.
  Errors are returned and shown under the form.
- Concurrent edits: last write wins (accepted).

## Testing

- Vitest unit tests for `lib/split.ts`: equal split with remainder, shares split,
  exact mismatch detection, balances sum to zero, settle produces correct transfers.
- Manual end-to-end check in browser: create group → add 3 expenses (one of each
  type) → verify balances and settle list → record payment → balances zero out.

## Deployment

README documents: create Neon DB, set `DATABASE_URL`, run `npx drizzle-kit push`,
import repo into Vercel with the same env var.

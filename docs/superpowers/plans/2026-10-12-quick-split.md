# Quick Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A link-shared, no-login web app that splits group expenses (equal / exact / shares) and shows balances plus a minimal settle-up list.

**Architecture:** Next.js App Router. Server Components read Postgres through Drizzle; Server Actions in one file (`app/actions.ts`) do every mutation and validate with zod. All money math lives in pure functions in `lib/split.ts`, shared by the server (balances) and the client (live preview in the expense form), and unit-tested with Vitest.

**Tech Stack:** Next.js 16.4 (React 19, TypeScript, Tailwind v4), drizzle-orm 0.45 + drizzle-kit 0.31 + pg 8, zod 4, Vitest 5. Node 26 locally. Local DB = Docker `postgres:17`; production = Neon + Vercel.

**Spec:** `docs/superpowers/specs/2026-10-12-quick-split-design.md`

## Global Constraints

- All UI copy is Vietnamese. `<html lang="vi">`.
- Money is integer VND (đồng), stored as Postgres `bigint` (`mode: 'number'`), formatted with `Intl.NumberFormat('vi-VN')` + `"đ"`.
- Max amount `1_000_000_000_000` (1 trillion); max shares per member `1000`. Keeps `amount * shares` far below `Number.MAX_SAFE_INTEGER`.
- Group id = `crypto.randomBytes(16).toString('base64url')` (22 chars). No `nanoid` dependency.
- Every Server Action that takes a member id or expense id must scope its query by `groupId` (anyone can call actions with arbitrary args).
- A group always keeps at least 2 members.
- Mobile-first layout, content column `max-w-lg`.
- No login, no realtime, no currencies other than VND.
- Next 16: `params` and `searchParams` in pages are `Promise`s and must be awaited.

## Review Focus

1. **Amount typed with thousands separators** ("150.000", "150,000", "150 000"): it should be read as 150000, not 150 or NaN. Pinned by the `parseVnd` tests in Task 1.
2. **Equal / shares split that does not divide evenly** (100.000đ / 3): the owed amounts must sum exactly to the expense amount, and every member's share must differ by at most 1đ. Pinned by the `computeShares` tests in Task 1.
3. **Absurdly large amount or shares** (e.g. 10^16): this must be rejected with a Vietnamese message, never silently lose precision. Pinned by the validation tests in Task 2.
4. **Duplicate member names when creating a group** ("An", "an"): these must be rejected, otherwise settle-up lines become ambiguous. Pinned by the validation tests in Task 2.
5. **Tampered ids in URLs/actions** (an expense id from another group): the app must not show or touch the other group's data. Implemented in Tasks 4–5 by scoping every `where` with `groupId`; checked manually in Task 7, step 4.

---

## File Structure

```
app/
  layout.tsx                 root layout (lang=vi, container)
  globals.css                tailwind + .input/.btn/.card component classes
  page.tsx                   home: title + <CreateGroupForm/>
  create-group-form.tsx      client form, useActionState(createGroup)
  actions.ts                 ALL server actions
  g/[id]/
    page.tsx                 group page: header, tabs (?tab=), 3 panels
    copy-link.tsx            client "Copy link" button
    delete-button.tsx        client confirm-then-submit button
    not-found.tsx            404 text for unknown group
    expense/
      expense-form.tsx       client expense form + live preview
      new/page.tsx           new expense page
      [eid]/page.tsx         edit expense page
db/
  schema.ts                  drizzle tables
  index.ts                   db client
  queries.ts                 getGroup(id)
lib/
  split.ts / split.test.ts           computeShares, balances, settle
  money.ts / money.test.ts           formatVnd, parseVnd
  validation.ts / validation.test.ts zod schemas
drizzle.config.ts
README.md
```

---

### Task 1: Scaffold project + money and split logic (TDD)

**Files:**
- Create (scaffold): Next.js app files at repo root
- Create: `lib/money.ts`, `lib/money.test.ts`, `lib/split.ts`, `lib/split.test.ts`
- Modify: `package.json` (add `test` script)

**Interfaces:**
- Produces:
  - `formatVnd(n: number): string` → e.g. `"150.000đ"`
  - `parseVnd(s: string): number` → digits only, `""` → `0`
  - `type SplitType = 'equal' | 'exact' | 'shares'`
  - `type Split = { memberId: number; value: number }`
  - `type ExpenseLike = { amount: number; payerId: number; splitType: SplitType; splits: Split[] }`
  - `type Transfer = { from: number; to: number; amount: number }`
  - `computeShares(amount: number, splitType: SplitType, splits: Split[]): Map<number, number>`
  - `balances(expenses: ExpenseLike[]): Map<number, number>` (paid − owed)
  - `settle(bal: Map<number, number>): Transfer[]`

- [ ] **Step 1: Scaffold Next.js in a temp dir and copy in (repo root is not empty)**

```bash
cd /Users/xuanchien/Project/claude-app/quick-split
npx create-next-app@16.4.0 tmp-app --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes
rsync -a --exclude .git --exclude CLAUDE.md --exclude AGENTS.md tmp-app/ ./
rm -rf tmp-app
npm install drizzle-orm@0.45.4 pg@8.23.1 zod@4.6.6
npm install -D drizzle-kit@0.31.11 @types/pg@8.23.1 vitest@5.0.3
npm pkg set scripts.test="vitest run"
```

Expected: `package.json`, `app/`, `node_modules/` exist; the project's own `CLAUDE.md` is untouched (`head -3 CLAUDE.md` still shows `# CLAUDE.md` then `Behavioral guidelines…`).

- [ ] **Step 2: Write failing tests for money**

`lib/money.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatVnd, parseVnd } from './money';

describe('parseVnd', () => {
  it('reads plain digits', () => expect(parseVnd('150000')).toBe(150000));
  it('ignores dot, comma and space separators', () => {
    expect(parseVnd('150.000')).toBe(150000);
    expect(parseVnd('150,000')).toBe(150000);
    expect(parseVnd('150 000đ')).toBe(150000);
  });
  it('returns 0 for empty or non-numeric', () => {
    expect(parseVnd('')).toBe(0);
    expect(parseVnd('abc')).toBe(0);
  });
});

describe('formatVnd', () => {
  it('formats with vi-VN grouping and đ', () => expect(formatVnd(150000)).toBe('150.000đ'));
  it('keeps the minus sign', () => expect(formatVnd(-5000)).toBe('-5.000đ'));
});
```

- [ ] **Step 3: Write failing tests for split**

`lib/split.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { balances, computeShares, settle, type ExpenseLike } from './split';

const sum = (m: Map<number, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe('computeShares', () => {
  it('equal split, even', () => {
    const r = computeShares(300, 'equal', [{ memberId: 1, value: 1 }, { memberId: 2, value: 1 }, { memberId: 3, value: 1 }]);
    expect([...r]).toEqual([[1, 100], [2, 100], [3, 100]]);
  });

  it('equal split with remainder sums exactly, first members get the extra đồng', () => {
    const r = computeShares(100000, 'equal', [{ memberId: 1, value: 1 }, { memberId: 2, value: 1 }, { memberId: 3, value: 1 }]);
    expect([...r]).toEqual([[1, 33334], [2, 33333], [3, 33333]]);
    expect(sum(r)).toBe(100000);
  });

  it('equal ignores value and treats every listed member as one share', () => {
    const r = computeShares(200, 'equal', [{ memberId: 1, value: 5 }, { memberId: 2, value: 1 }]);
    expect([...r]).toEqual([[1, 100], [2, 100]]);
  });

  it('shares split proportionally with remainder', () => {
    const r = computeShares(1000, 'shares', [{ memberId: 1, value: 2 }, { memberId: 2, value: 1 }]);
    expect([...r]).toEqual([[1, 667], [2, 333]]);
    expect(sum(r)).toBe(1000);
  });

  it('exact returns values as given', () => {
    const r = computeShares(500, 'exact', [{ memberId: 1, value: 200 }, { memberId: 2, value: 300 }]);
    expect([...r]).toEqual([[1, 200], [2, 300]]);
  });

  it('returns empty map when there are no splits', () => {
    expect(computeShares(500, 'equal', []).size).toBe(0);
  });
});

describe('balances', () => {
  it('payer gets credit, participants get debit, sum is zero', () => {
    const expenses: ExpenseLike[] = [
      { amount: 300, payerId: 1, splitType: 'equal', splits: [{ memberId: 1, value: 1 }, { memberId: 2, value: 1 }, { memberId: 3, value: 1 }] },
      { amount: 100, payerId: 2, splitType: 'exact', splits: [{ memberId: 3, value: 100 }] },
    ];
    const b = balances(expenses);
    expect(b.get(1)).toBe(200);
    expect(b.get(2)).toBe(0);
    expect(b.get(3)).toBe(-200);
    expect(sum(b)).toBe(0);
  });
});

describe('settle', () => {
  it('matches largest debtor with largest creditor', () => {
    const t = settle(new Map([[1, 300], [2, -100], [3, -200]]));
    expect(t).toEqual([
      { from: 3, to: 1, amount: 200 },
      { from: 2, to: 1, amount: 100 },
    ]);
  });

  it('zeroes every balance and uses at most n-1 transfers', () => {
    const bal = new Map([[1, 500], [2, -50], [3, -150], [4, 200], [5, -500]]);
    const t = settle(bal);
    const after = new Map(bal);
    for (const { from, to, amount } of t) {
      after.set(from, after.get(from)! + amount);
      after.set(to, after.get(to)! - amount);
    }
    expect([...after.values()].every((v) => v === 0)).toBe(true);
    expect(t.length).toBeLessThanOrEqual(bal.size - 1);
  });

  it('returns nothing when everyone is settled', () => {
    expect(settle(new Map([[1, 0], [2, 0]]))).toEqual([]);
  });
});
```

- [ ] **Step 4: Run tests, expect failure**

Run: `npm test`
Expected: FAIL, `Failed to resolve import "./money"` / `"./split"`.

- [ ] **Step 5: Implement `lib/money.ts`**

```ts
const fmt = new Intl.NumberFormat('vi-VN');

export function formatVnd(n: number): string {
  return fmt.format(n) + 'đ';
}

export function parseVnd(s: string): number {
  const digits = s.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}
```

- [ ] **Step 6: Implement `lib/split.ts`**

```ts
export type SplitType = 'equal' | 'exact' | 'shares';
export type Split = { memberId: number; value: number };
export type ExpenseLike = { amount: number; payerId: number; splitType: SplitType; splits: Split[] };
export type Transfer = { from: number; to: number; amount: number };

export function computeShares(amount: number, splitType: SplitType, splits: Split[]): Map<number, number> {
  const owed = new Map<number, number>();
  if (splitType === 'exact') {
    for (const s of splits) owed.set(s.memberId, s.value);
    return owed;
  }
  const weights = splits.map((s) => (splitType === 'equal' ? 1 : s.value));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return owed;
  let assigned = 0;
  splits.forEach((s, i) => {
    const v = Math.floor((amount * weights[i]) / total);
    owed.set(s.memberId, v);
    assigned += v;
  });
  // leftover is < splits.length; hand out 1đ each in split order
  for (let i = 0; assigned < amount; i++, assigned++) {
    const id = splits[i % splits.length].memberId;
    owed.set(id, owed.get(id)! + 1);
  }
  return owed;
}

export function balances(expenses: ExpenseLike[]): Map<number, number> {
  const bal = new Map<number, number>();
  const add = (id: number, v: number) => bal.set(id, (bal.get(id) ?? 0) + v);
  for (const e of expenses) {
    add(e.payerId, e.amount);
    for (const [id, v] of computeShares(e.amount, e.splitType, e.splits)) add(id, -v);
  }
  return bal;
}

// ponytail: greedy, at most n-1 transfers; not the true minimum (NP-hard), fine for friend groups
export function settle(bal: Map<number, number>): Transfer[] {
  const debtors = [...bal].filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const creditors = [...bal].filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const out: Transfer[] = [];
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.v - a.v);
    creditors.sort((a, b) => b.v - a.v);
    const d = debtors[0];
    const c = creditors[0];
    const amount = Math.min(d.v, c.v);
    out.push({ from: d.id, to: c.id, amount });
    d.v -= amount;
    c.v -= amount;
    if (d.v === 0) debtors.shift();
    if (c.v === 0) creditors.shift();
  }
  return out;
}
```

- [ ] **Step 7: Run tests, expect pass**

Run: `npm test`
Expected: all tests in `lib/money.test.ts` and `lib/split.test.ts` PASS.

- [ ] **Step 8: Commit**

Stage explicitly. Do NOT use `git add -A`: the pre-existing untracked `.agents/`, `.claude/`, `CLAUDE.md`, `skills-lock.json` must stay out of this commit.

```bash
git status --short   # see what create-next-app generated
git add app lib public package.json package-lock.json tsconfig.json next.config.ts eslint.config.mjs postcss.config.mjs next-env.d.ts .gitignore README.md
git status --short   # node_modules, .next, tmp-app must NOT be staged
git commit -m "feat: scaffold Next.js app with money and split logic"
```

(Adjust the file list to what `git status` actually shows; e.g. drop `next-env.d.ts` if it was not generated.)

---

### Task 2: Validation schemas (TDD)

**Files:**
- Create: `lib/validation.ts`, `lib/validation.test.ts`

**Interfaces:**
- Consumes: `formatVnd` from `lib/money.ts`
- Produces:
  - `MAX_AMOUNT = 1_000_000_000_000`, `MAX_SHARES = 1000`
  - `groupInput` (zod): `{ name: string; members: string[] }`
  - `memberName` (zod string)
  - `expenseInput` (zod): `{ title: string; amount: number; payerId: number; splitType: SplitType; splits: Split[] }`
  - `type ExpenseInput = z.infer<typeof expenseInput>`
  - `firstError(e: z.ZodError): string`

- [ ] **Step 1: Write failing tests**

`lib/validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { expenseInput, firstError, groupInput, MAX_AMOUNT } from './validation';

const ok = { title: 'Ăn tối', amount: 300000, payerId: 1, splitType: 'equal' as const, splits: [{ memberId: 1, value: 1 }, { memberId: 2, value: 1 }] };
const err = (input: unknown) => {
  const r = expenseInput.safeParse(input);
  return r.success ? null : firstError(r.error);
};

describe('groupInput', () => {
  it('accepts a name and 2+ members, trimming', () => {
    const r = groupInput.parse({ name: ' Đà Lạt ', members: [' An', 'Bình '] });
    expect(r).toEqual({ name: 'Đà Lạt', members: ['An', 'Bình'] });
  });
  it('rejects fewer than 2 members', () => {
    expect(groupInput.safeParse({ name: 'x', members: ['An'] }).success).toBe(false);
  });
  it('rejects duplicate names case-insensitively', () => {
    const r = groupInput.safeParse({ name: 'x', members: ['An', 'an'] });
    expect(r.success).toBe(false);
    expect(firstError(r.error!)).toBe('Tên thành viên bị trùng');
  });
  it('rejects empty group name', () => {
    expect(groupInput.safeParse({ name: '  ', members: ['An', 'Bình'] }).success).toBe(false);
  });
});

describe('expenseInput', () => {
  it('accepts a valid equal expense', () => expect(err(ok)).toBeNull());
  it('rejects zero amount', () => expect(err({ ...ok, amount: 0 })).toBe('Số tiền phải lớn hơn 0'));
  it('rejects amount above the cap', () => expect(err({ ...ok, amount: MAX_AMOUNT + 1 })).toBe('Số tiền quá lớn'));
  it('rejects empty title', () => expect(err({ ...ok, title: ' ' })).toBe('Nhập tên khoản chi'));
  it('rejects no participants', () => expect(err({ ...ok, splits: [] })).toBe('Chọn ít nhất 1 người'));
  it('rejects duplicate participants', () => {
    expect(err({ ...ok, splits: [{ memberId: 1, value: 1 }, { memberId: 1, value: 1 }] })).toBe('Thành viên bị trùng');
  });
  it('rejects exact split whose sum differs from amount', () => {
    expect(err({ ...ok, splitType: 'exact', amount: 500, splits: [{ memberId: 1, value: 200 }, { memberId: 2, value: 200 }] }))
      .toBe('Tổng chia (400đ) phải bằng số tiền (500đ)');
  });
  it('accepts exact split whose sum matches', () => {
    expect(err({ ...ok, splitType: 'exact', amount: 500, splits: [{ memberId: 1, value: 200 }, { memberId: 2, value: 300 }] })).toBeNull();
  });
  it('rejects shares above 1000', () => {
    expect(err({ ...ok, splitType: 'shares', splits: [{ memberId: 1, value: 1001 }] })).toBe('Số phần tối đa 1000');
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `npm test -- lib/validation.test.ts`
Expected: FAIL, `Failed to resolve import "./validation"`.

- [ ] **Step 3: Implement `lib/validation.ts`**

```ts
import { z } from 'zod';
import { formatVnd } from './money';

export const MAX_AMOUNT = 1_000_000_000_000;
export const MAX_SHARES = 1000;

export const memberName = z.string().trim().min(1, 'Nhập tên thành viên').max(50, 'Tên tối đa 50 ký tự');

export const groupInput = z.object({
  name: z.string().trim().min(1, 'Nhập tên nhóm').max(100, 'Tên nhóm tối đa 100 ký tự'),
  members: z
    .array(memberName)
    .min(2, 'Cần ít nhất 2 thành viên')
    .max(50, 'Tối đa 50 thành viên')
    .refine((a) => new Set(a.map((s) => s.toLowerCase())).size === a.length, 'Tên thành viên bị trùng'),
});

export const expenseInput = z
  .object({
    title: z.string().trim().min(1, 'Nhập tên khoản chi').max(100, 'Tên tối đa 100 ký tự'),
    amount: z.number().int().positive('Số tiền phải lớn hơn 0').max(MAX_AMOUNT, 'Số tiền quá lớn'),
    payerId: z.number().int(),
    splitType: z.enum(['equal', 'exact', 'shares']),
    splits: z
      .array(z.object({ memberId: z.number().int(), value: z.number().int().positive().max(MAX_AMOUNT) }))
      .min(1, 'Chọn ít nhất 1 người'),
  })
  .superRefine((e, ctx) => {
    const ids = e.splits.map((s) => s.memberId);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Thành viên bị trùng' });
    if (e.splitType === 'shares' && e.splits.some((s) => s.value > MAX_SHARES)) {
      ctx.addIssue({ code: 'custom', message: `Số phần tối đa ${MAX_SHARES}` });
    }
    if (e.splitType === 'exact') {
      const total = e.splits.reduce((a, s) => a + s.value, 0);
      if (total !== e.amount) {
        ctx.addIssue({ code: 'custom', message: `Tổng chia (${formatVnd(total)}) phải bằng số tiền (${formatVnd(e.amount)})` });
      }
    }
  });

export type ExpenseInput = z.infer<typeof expenseInput>;

export function firstError(e: z.ZodError): string {
  return e.issues[0]?.message ?? 'Dữ liệu không hợp lệ';
}
```

Field-level issues are always recorded before `superRefine` issues, so `firstError` reports the field problem first.

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test`
Expected: all tests PASS (money, split, validation).

- [ ] **Step 5: Commit**

```bash
git add lib/validation.ts lib/validation.test.ts
git commit -m "feat: add zod validation for groups and expenses"
```

---

### Task 3: Database schema, client, query

**Files:**
- Create: `db/schema.ts`, `db/index.ts`, `db/queries.ts`, `drizzle.config.ts`, `.env.local` (not committed)
- Modify: `package.json` (add `db:push` script)

**Interfaces:**
- Consumes: `Split`, `SplitType` from `lib/split.ts` (structurally — the enum values match)
- Produces:
  - tables `groups`, `members`, `expenses`, `expenseSplits` from `@/db/schema`
  - `db` from `@/db`
  - `getGroup(id: string)` from `@/db/queries`, returning `null` or
    `{ group: { id: string; name: string; createdAt: Date }; members: { id: number; groupId: string; name: string }[]; expenses: { id: number; groupId: string; title: string; amount: number; payerId: number; splitType: 'equal' | 'exact' | 'shares'; createdAt: Date; splits: { memberId: number; value: number }[] }[] }`
    (members ordered by id, expenses newest first, splits in insert order)
  - `type GroupData` = the non-null return type above

- [ ] **Step 1: Start local Postgres and write `.env.local`**

```bash
docker run -d --name quick-split-pg -e POSTGRES_PASSWORD=pg -e POSTGRES_DB=quicksplit -p 5432:5432 postgres:17
echo 'DATABASE_URL=postgres://postgres:pg@localhost:5432/quicksplit' > .env.local
git check-ignore .env.local
```

Expected: `docker ps` shows `quick-split-pg` running; `git check-ignore` prints `.env.local` (generated `.gitignore` covers `.env*`).

- [ ] **Step 2: Write `db/schema.ts`**

```ts
import { bigint, integer, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const splitType = pgEnum('split_type', ['equal', 'exact', 'shares']);

export const groups = pgTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const members = pgTable('members', {
  id: serial('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
});

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  payerId: integer('payer_id').notNull().references(() => members.id),
  splitType: splitType('split_type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const expenseSplits = pgTable('expense_splits', {
  id: serial('id').primaryKey(),
  expenseId: integer('expense_id').notNull().references(() => expenses.id, { onDelete: 'cascade' }),
  memberId: integer('member_id').notNull().references(() => members.id),
  value: bigint('value', { mode: 'number' }).notNull(),
});
```

The FKs from `expenses.payer_id` / `expense_splits.member_id` to `members` (no cascade) make the DB itself refuse to delete a member who is used.

- [ ] **Step 3: Write `db/index.ts`**

```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export const db = drizzle(process.env.DATABASE_URL!, { schema });
```

- [ ] **Step 4: Write `drizzle.config.ts`, add script, push schema**

```ts
import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile('.env.local');
} catch {} // absent on Vercel/CI, where DATABASE_URL is set in the environment

export default defineConfig({
  schema: './db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

```bash
npm pkg set scripts.db:push="drizzle-kit push"
npm run db:push
docker exec quick-split-pg psql -U postgres -d quicksplit -c '\dt'
```

Expected: drizzle-kit reports changes applied; `\dt` lists `groups`, `members`, `expenses`, `expense_splits`.

- [ ] **Step 5: Write `db/queries.ts`**

```ts
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '.';
import { expenses, expenseSplits, groups, members } from './schema';

export async function getGroup(id: string) {
  const [group] = await db.select().from(groups).where(eq(groups.id, id));
  if (!group) return null;
  const mems = await db.select().from(members).where(eq(members.groupId, id)).orderBy(asc(members.id));
  const exps = await db
    .select()
    .from(expenses)
    .where(eq(expenses.groupId, id))
    .orderBy(desc(expenses.createdAt), desc(expenses.id));
  const splits = exps.length
    ? await db
        .select()
        .from(expenseSplits)
        .where(inArray(expenseSplits.expenseId, exps.map((e) => e.id)))
        .orderBy(asc(expenseSplits.id))
    : [];
  return {
    group,
    members: mems,
    expenses: exps.map((e) => ({
      ...e,
      splits: splits.filter((s) => s.expenseId === e.id).map((s) => ({ memberId: s.memberId, value: s.value })),
    })),
  };
}

export type GroupData = NonNullable<Awaited<ReturnType<typeof getGroup>>>;
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add db drizzle.config.ts package.json
git commit -m "feat: add drizzle schema, db client and getGroup query"
```

---

### Task 4: Create group, group page shell, members tab

**Files:**
- Create: `app/actions.ts`, `app/create-group-form.tsx`, `app/g/[id]/page.tsx`, `app/g/[id]/copy-link.tsx`, `app/g/[id]/delete-button.tsx`, `app/g/[id]/not-found.tsx`
- Modify (replace content): `app/layout.tsx`, `app/globals.css`, `app/page.tsx`

**Interfaces:**
- Consumes: `groupInput`, `memberName`, `firstError` (Task 2); `db`, tables (Task 3); `getGroup`, `GroupData` (Task 3)
- Produces (in `app/actions.ts`, file-level `'use server'`):
  - `type Result = { error: string } | undefined`
  - `groupMembers(groupId: string)` (non-exported helper → `{ id: number; name: string }[]`)
  - `createGroup(_prev: Result, formData: FormData): Promise<Result>` (redirects to `/g/{id}` on success)
  - `addMember(groupId: string, formData: FormData): Promise<void>`
  - `renameMember(groupId: string, memberId: number, formData: FormData): Promise<void>`
  - `deleteMember(groupId: string, memberId: number): Promise<void>`
- Produces UI: `DeleteButton({ action, confirmText }: { action: () => Promise<void>; confirmText: string })` in `app/g/[id]/delete-button.tsx`; `CopyLink()` in `app/g/[id]/copy-link.tsx`

- [ ] **Step 1: Replace `app/globals.css`**

```css
@import "tailwindcss";

@layer components {
  .input {
    @apply w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-emerald-500;
  }
  .btn {
    @apply rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50;
  }
  .card {
    @apply rounded-xl border border-gray-200 bg-white p-4;
  }
}
```

- [ ] **Step 2: Replace `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Quick Split', description: 'Chia tiền nhóm nhanh' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className="bg-gray-50 text-gray-900">
        <main className="mx-auto max-w-lg p-4">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Write `app/actions.ts` (group + member actions)**

```ts
'use server';

import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { expenses, expenseSplits, groups, members } from '@/db/schema';
import { firstError, groupInput, memberName } from '@/lib/validation';

export type Result = { error: string } | undefined;

const groupMembers = (groupId: string) =>
  db.select({ id: members.id, name: members.name }).from(members).where(eq(members.groupId, groupId));

export async function createGroup(_prev: Result, formData: FormData): Promise<Result> {
  const parsed = groupInput.safeParse({
    name: String(formData.get('name') ?? ''),
    members: String(formData.get('members') ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const id = randomBytes(16).toString('base64url');
  await db.transaction(async (tx) => {
    await tx.insert(groups).values({ id, name: parsed.data.name });
    await tx.insert(members).values(parsed.data.members.map((name) => ({ groupId: id, name })));
  });
  redirect(`/g/${id}`);
}

export async function addMember(groupId: string, formData: FormData): Promise<void> {
  const name = memberName.safeParse(String(formData.get('name') ?? ''));
  if (!name.success) return;
  const existing = await groupMembers(groupId);
  if (existing.some((m) => m.name.toLowerCase() === name.data.toLowerCase())) return;
  await db.insert(members).values({ groupId, name: name.data });
  revalidatePath(`/g/${groupId}`);
}

export async function renameMember(groupId: string, memberId: number, formData: FormData): Promise<void> {
  const name = memberName.safeParse(String(formData.get('name') ?? ''));
  if (!name.success) return;
  const existing = await groupMembers(groupId);
  if (existing.some((m) => m.id !== memberId && m.name.toLowerCase() === name.data.toLowerCase())) return;
  await db
    .update(members)
    .set({ name: name.data })
    .where(and(eq(members.id, memberId), eq(members.groupId, groupId)));
  revalidatePath(`/g/${groupId}`);
}

export async function deleteMember(groupId: string, memberId: number): Promise<void> {
  // UI disables the button in these cases; this guards direct calls
  if ((await groupMembers(groupId)).length <= 2) return;
  const [paid] = await db.select({ id: expenses.id }).from(expenses).where(eq(expenses.payerId, memberId)).limit(1);
  const [split] = await db
    .select({ id: expenseSplits.id })
    .from(expenseSplits)
    .where(eq(expenseSplits.memberId, memberId))
    .limit(1);
  if (paid || split) return;
  await db.delete(members).where(and(eq(members.id, memberId), eq(members.groupId, groupId)));
  revalidatePath(`/g/${groupId}`);
}
```

- [ ] **Step 4: Write `app/create-group-form.tsx`**

```tsx
'use client';

import { useActionState } from 'react';
import { createGroup } from './actions';

export function CreateGroupForm() {
  const [state, action, pending] = useActionState(createGroup, undefined);
  return (
    <form action={action} className="card space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Tên nhóm</span>
        <input name="name" required maxLength={100} placeholder="Đà Lạt 2026" className="input" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Thành viên (mỗi dòng 1 người)</span>
        <textarea name="members" required rows={5} placeholder={'An\nBình\nChi'} className="input" />
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="btn w-full">
        {pending ? 'Đang tạo…' : 'Tạo nhóm'}
      </button>
    </form>
  );
}
```

- [ ] **Step 5: Replace `app/page.tsx`**

```tsx
import { CreateGroupForm } from './create-group-form';

export default function Home() {
  return (
    <div className="space-y-6 pt-8">
      <div>
        <h1 className="text-2xl font-bold">Quick Split</h1>
        <p className="text-gray-600">Chia tiền nhóm nhanh. Tạo nhóm, gửi link cho bạn bè, không cần đăng nhập.</p>
      </div>
      <CreateGroupForm />
    </div>
  );
}
```

- [ ] **Step 6: Write `app/g/[id]/copy-link.tsx` and `app/g/[id]/delete-button.tsx`**

`app/g/[id]/copy-link.tsx`:

```tsx
'use client';

import { useState } from 'react';

export function CopyLink() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="shrink-0 rounded-lg border border-gray-300 px-3 py-1 text-sm"
      onClick={async () => {
        await navigator.clipboard.writeText(location.origin + location.pathname);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'Đã copy ✓' : 'Copy link'}
    </button>
  );
}
```

`app/g/[id]/delete-button.tsx`:

```tsx
'use client';

export function DeleteButton({ action, confirmText }: { action: () => Promise<void>; confirmText: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <button className="text-sm text-red-600">Xoá</button>
    </form>
  );
}
```

- [ ] **Step 7: Write `app/g/[id]/not-found.tsx`**

```tsx
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
```

- [ ] **Step 8: Write `app/g/[id]/page.tsx` (shell + members tab; the other two tabs are placeholders replaced in Tasks 5–6)**

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addMember, deleteMember, renameMember } from '@/app/actions';
import { getGroup, type GroupData } from '@/db/queries';
import { CopyLink } from './copy-link';

const TABS = [
  ['expenses', 'Khoản chi'],
  ['balances', 'Số dư'],
  ['members', 'Thành viên'],
] as const;

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = 'expenses' } = await searchParams;
  const data = await getGroup(id);
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="truncate text-xl font-bold">{data.group.name}</h1>
        <CopyLink />
      </header>
      <nav className="grid grid-cols-3 rounded-lg bg-gray-200 p-1 text-center text-sm">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/g/${id}?tab=${key}`}
            className={`rounded-md py-1.5 ${tab === key ? 'bg-white font-medium shadow-sm' : 'text-gray-600'}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === 'members' && <MembersTab data={data} />}
      {tab === 'balances' && <p>Số dư (Task 6)</p>}
      {tab !== 'members' && tab !== 'balances' && <p>Khoản chi (Task 5)</p>}
    </div>
  );
}

function MembersTab({ data }: { data: GroupData }) {
  const id = data.group.id;
  const used = new Set(data.expenses.flatMap((e) => [e.payerId, ...e.splits.map((s) => s.memberId)]));
  const minReached = data.members.length <= 2;
  return (
    <div className="card space-y-3">
      {data.members.map((m) => {
        const locked = minReached || used.has(m.id);
        return (
          <div key={m.id} className="flex items-center gap-2">
            <form action={renameMember.bind(null, id, m.id)} className="flex flex-1 gap-2">
              <input name="name" defaultValue={m.name} required maxLength={50} className="input" />
              <button className="text-sm text-emerald-700">Lưu</button>
            </form>
            <form action={deleteMember.bind(null, id, m.id)}>
              <button
                disabled={locked}
                title={used.has(m.id) ? 'Đã có khoản chi, không xoá được' : minReached ? 'Nhóm cần ít nhất 2 người' : undefined}
                className="text-sm text-red-600 disabled:text-gray-300"
              >
                Xoá
              </button>
            </form>
          </div>
        );
      })}
      <form action={addMember.bind(null, id)} className="flex gap-2 border-t border-gray-200 pt-3">
        <input name="name" required maxLength={50} placeholder="Tên thành viên mới" className="input" />
        <button className="btn">Thêm</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 9: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 10: Manual check**

Run `npm run dev` (background), then in a browser at `http://localhost:3000`:
1. Submit with one member → shows "Cần ít nhất 2 thành viên" (At least 2 members required).
2. Submit "Test" with `An`, `Bình`, `Chi` → redirects to `/g/<22-char id>`, header shows "Test".
3. Tab "Thành viên" (Members): rename Chi → "Chi Ng", add "Dũng", delete "Dũng" → each persists after reload. With only 2 members left, "Xoá" (Delete) is disabled.
4. `http://localhost:3000/g/doesnotexist` → "Không tìm thấy nhóm này" (Group not found).

- [ ] **Step 11: Commit**

```bash
git add app
git commit -m "feat: create group, group page shell and members tab"
```

---

### Task 5: Expenses — form, save/delete actions, list

**Files:**
- Modify: `app/actions.ts` (append expense actions), `app/g/[id]/page.tsx` (replace expenses placeholder)
- Create: `app/g/[id]/expense/expense-form.tsx`, `app/g/[id]/expense/new/page.tsx`, `app/g/[id]/expense/[eid]/page.tsx`

**Interfaces:**
- Consumes: `computeShares`, `Split`, `SplitType` (Task 1); `formatVnd`, `parseVnd` (Task 1); `expenseInput`, `ExpenseInput`, `firstError` (Task 2); `getGroup`, `GroupData` (Task 3); `Result`, `groupMembers`, `DeleteButton` (Task 4)
- Produces (in `app/actions.ts`):
  - `writeExpense(groupId: string, expenseId: number | null, input: ExpenseInput): Promise<Result>`, not exported, reused by Task 6
  - `saveExpense(groupId: string, expenseId: number | null, input: ExpenseInput): Promise<Result>` (redirects to `/g/{groupId}` on success)
  - `deleteExpense(groupId: string, expenseId: number): Promise<void>`

- [ ] **Step 1: Append to `app/actions.ts`**

Change the validation import to `import { expenseInput, firstError, groupInput, memberName, type ExpenseInput } from '@/lib/validation';`, then append:

```ts
async function writeExpense(groupId: string, expenseId: number | null, input: ExpenseInput): Promise<Result> {
  const parsed = expenseInput.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const e = parsed.data;
  const ids = new Set((await groupMembers(groupId)).map((m) => m.id));
  if (!ids.has(e.payerId) || e.splits.some((s) => !ids.has(s.memberId))) return { error: 'Thành viên không hợp lệ' };
  const values = { title: e.title, amount: e.amount, payerId: e.payerId, splitType: e.splitType };
  const found = await db.transaction(async (tx) => {
    let id: number;
    if (expenseId === null) {
      const [row] = await tx.insert(expenses).values({ ...values, groupId }).returning({ id: expenses.id });
      id = row.id;
    } else {
      const updated = await tx
        .update(expenses)
        .set(values)
        .where(and(eq(expenses.id, expenseId), eq(expenses.groupId, groupId)))
        .returning({ id: expenses.id });
      if (!updated.length) return false;
      id = expenseId;
      await tx.delete(expenseSplits).where(eq(expenseSplits.expenseId, id));
    }
    await tx.insert(expenseSplits).values(e.splits.map((s) => ({ expenseId: id, memberId: s.memberId, value: s.value })));
    return true;
  });
  if (!found) return { error: 'Không tìm thấy khoản chi' };
  revalidatePath(`/g/${groupId}`);
  return undefined;
}

export async function saveExpense(groupId: string, expenseId: number | null, input: ExpenseInput): Promise<Result> {
  const res = await writeExpense(groupId, expenseId, input);
  if (res) return res;
  redirect(`/g/${groupId}`);
}

export async function deleteExpense(groupId: string, expenseId: number): Promise<void> {
  await db.delete(expenses).where(and(eq(expenses.id, expenseId), eq(expenses.groupId, groupId)));
  revalidatePath(`/g/${groupId}`);
}
```

- [ ] **Step 2: Write `app/g/[id]/expense/expense-form.tsx`**

```tsx
'use client';

import { type FormEvent, useState, useTransition } from 'react';
import { saveExpense } from '@/app/actions';
import { formatVnd, parseVnd } from '@/lib/money';
import { computeShares, type Split, type SplitType } from '@/lib/split';

type Member = { id: number; name: string };
type Expense = { id: number; title: string; amount: number; payerId: number; splitType: SplitType; splits: Split[] };

const TYPES: [SplitType, string][] = [
  ['equal', 'Chia đều'],
  ['exact', 'Theo số tiền'],
  ['shares', 'Theo phần'],
];

export function ExpenseForm({ groupId, members, expense }: { groupId: string; members: Member[]; expense?: Expense }) {
  const initial = (t: SplitType, fallback: string): Record<number, string> =>
    Object.fromEntries(
      members.map((m) => {
        const s = expense?.splitType === t ? expense.splits.find((x) => x.memberId === m.id) : undefined;
        return [m.id, s ? String(s.value) : fallback];
      }),
    );

  const [title, setTitle] = useState(expense?.title ?? '');
  const [amountText, setAmountText] = useState(expense ? String(expense.amount) : '');
  const [payerId, setPayerId] = useState(expense?.payerId ?? members[0].id);
  const [splitType, setSplitType] = useState<SplitType>(expense?.splitType ?? 'equal');
  const [equal, setEqual] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(
      members.map((m) => [m.id, expense?.splitType === 'equal' ? expense.splits.some((s) => s.memberId === m.id) : true]),
    ),
  );
  const [exact, setExact] = useState(() => initial('exact', ''));
  const [shares, setShares] = useState(() => initial('shares', '1'));
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const amount = parseVnd(amountText);
  const splits: Split[] =
    splitType === 'equal'
      ? members.filter((m) => equal[m.id]).map((m) => ({ memberId: m.id, value: 1 }))
      : members
          .map((m) => ({ memberId: m.id, value: parseVnd((splitType === 'exact' ? exact : shares)[m.id] ?? '') }))
          .filter((s) => s.value > 0);
  const owed = computeShares(amount, splitType, splits);
  const exactSum = splits.reduce((a, s) => a + s.value, 0);

  function submit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveExpense(groupId, expense?.id ?? null, { title, amount, payerId, splitType, splits });
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Tên khoản chi</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={100} placeholder="Ăn tối" className="input" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">
          Số tiền {amount > 0 && <span className="text-gray-500">= {formatVnd(amount)}</span>}
        </span>
        <input value={amountText} onChange={(e) => setAmountText(e.target.value)} required inputMode="numeric" placeholder="300000" className="input" />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Người trả</span>
        <select value={payerId} onChange={(e) => setPayerId(Number(e.target.value))} className="input">
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-3 rounded-lg bg-gray-200 p-1 text-center text-sm">
        {TYPES.map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setSplitType(t)}
            className={`rounded-md py-1.5 ${splitType === t ? 'bg-white font-medium shadow-sm' : 'text-gray-600'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-2">
            {splitType === 'equal' && (
              <input
                type="checkbox"
                checked={!!equal[m.id]}
                onChange={(e) => setEqual({ ...equal, [m.id]: e.target.checked })}
                className="size-5"
                aria-label={m.name}
              />
            )}
            <span className="flex-1">{m.name}</span>
            {splitType === 'exact' && (
              <input
                value={exact[m.id]}
                onChange={(e) => setExact({ ...exact, [m.id]: e.target.value })}
                inputMode="numeric"
                placeholder="0"
                className="input w-32 text-right"
                aria-label={`Số tiền của ${m.name}`}
              />
            )}
            {splitType === 'shares' && (
              <input
                value={shares[m.id]}
                onChange={(e) => setShares({ ...shares, [m.id]: e.target.value })}
                inputMode="numeric"
                className="input w-16 text-right"
                aria-label={`Số phần của ${m.name}`}
              />
            )}
            <span className="w-28 text-right text-sm text-gray-600">{owed.has(m.id) ? formatVnd(owed.get(m.id)!) : '–'}</span>
          </li>
        ))}
      </ul>
      {splitType === 'exact' && (
        <p className={`text-sm ${exactSum === amount ? 'text-gray-600' : 'text-red-600'}`}>
          Tổng chia: {formatVnd(exactSum)} / {formatVnd(amount)}
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={pending} className="btn w-full">
        {pending ? 'Đang lưu…' : 'Lưu'}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Write the two expense pages**

`app/g/[id]/expense/new/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGroup } from '@/db/queries';
import { ExpenseForm } from '../expense-form';

export default async function NewExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getGroup(id);
  if (!data) notFound();
  return (
    <div className="space-y-4">
      <Link href={`/g/${id}`} className="text-sm text-emerald-700">
        ← {data.group.name}
      </Link>
      <h1 className="text-xl font-bold">Thêm khoản chi</h1>
      <ExpenseForm groupId={id} members={data.members} />
    </div>
  );
}
```

`app/g/[id]/expense/[eid]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGroup } from '@/db/queries';
import { ExpenseForm } from '../expense-form';

export default async function EditExpensePage({ params }: { params: Promise<{ id: string; eid: string }> }) {
  const { id, eid } = await params;
  const data = await getGroup(id);
  const expense = data?.expenses.find((e) => e.id === Number(eid));
  if (!data || !expense) notFound();
  return (
    <div className="space-y-4">
      <Link href={`/g/${id}`} className="text-sm text-emerald-700">
        ← {data.group.name}
      </Link>
      <h1 className="text-xl font-bold">Sửa khoản chi</h1>
      <ExpenseForm groupId={id} members={data.members} expense={expense} />
    </div>
  );
}
```

- [ ] **Step 4: Replace the expenses placeholder in `app/g/[id]/page.tsx`**

Change the actions import to `import { addMember, deleteExpense, deleteMember, renameMember } from '@/app/actions';` and add:

```tsx
import { formatVnd } from '@/lib/money';
import { DeleteButton } from './delete-button';
```

Replace `{tab !== 'members' && tab !== 'balances' && <p>Khoản chi (Task 5)</p>}` with:

```tsx
      {tab !== 'members' && tab !== 'balances' && <ExpensesTab data={data} />}
```

Append to the file:

```tsx
function ExpensesTab({ data }: { data: GroupData }) {
  const id = data.group.id;
  const name = new Map(data.members.map((m) => [m.id, m.name]));
  return (
    <div className="space-y-3">
      <Link href={`/g/${id}/expense/new`} className="btn block text-center">
        + Thêm khoản chi
      </Link>
      {data.expenses.length === 0 && <p className="text-center text-gray-500">Chưa có khoản chi nào.</p>}
      {data.expenses.map((e) => (
        <div key={e.id} className="card flex items-center gap-3">
          <Link href={`/g/${id}/expense/${e.id}`} className="min-w-0 flex-1">
            <div className="truncate font-medium">{e.title}</div>
            <div className="text-sm text-gray-500">
              {name.get(e.payerId)} trả · {e.createdAt.toLocaleDateString('vi-VN')}
            </div>
          </Link>
          <div className="font-semibold">{formatVnd(e.amount)}</div>
          <DeleteButton action={deleteExpense.bind(null, id, e.id)} confirmText={`Xoá "${e.title}"?`} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Type-check, lint, unit tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: no errors, all tests PASS.

- [ ] **Step 6: Manual check**

With `npm run dev` running, in the group from Task 4 (members An, Bình, Chi Ng):
1. Add "Ăn tối" 300000, paid by An, "Chia đều" (equal split) among all 3 → preview shows 100.000đ each; list shows it.
2. Add "Taxi" typed as `100.000`, paid by Bình, "Theo phần" (by shares) An=2 Bình=1 Chi=1 → preview 50.000đ / 25.000đ / 25.000đ.
3. Add "Cafe" 90000, paid by Chi, "Theo số tiền" (exact amounts) An=30000 Bình=30000 Chi=20000 → red "Tổng chia: 80.000đ / 90.000đ"; clicking "Lưu" (Save) shows "Tổng chia (80.000đ) phải bằng số tiền (90.000đ)"; change Chi to 30000 → saves.
4. Open "Taxi", change amount to 120000 → list shows 120.000đ.
5. Delete "Taxi" → confirm dialog; Cancel keeps it, OK removes it.

- [ ] **Step 7: Commit**

```bash
git add app
git commit -m "feat: add, edit and delete expenses with three split types"
```

---

### Task 6: Balances tab + record payment

**Files:**
- Modify: `app/actions.ts` (append `recordPayment`), `app/g/[id]/page.tsx` (replace balances placeholder)

**Interfaces:**
- Consumes: `balances`, `settle`, `formatVnd` (Task 1); `writeExpense` (Task 5); `GroupData` (Task 3)
- Produces: `recordPayment(groupId: string, from: number, to: number, amount: number): Promise<void>` (redirects to `/g/{groupId}?tab=balances`)

- [ ] **Step 1: Append to `app/actions.ts`**

```ts
export async function recordPayment(groupId: string, from: number, to: number, amount: number): Promise<void> {
  const res = await writeExpense(groupId, null, {
    title: 'Thanh toán',
    amount,
    payerId: from,
    splitType: 'exact',
    splits: [{ memberId: to, value: amount }],
  });
  if (res) throw new Error(res.error); // only reachable with tampered args
  redirect(`/g/${groupId}?tab=balances`);
}
```

- [ ] **Step 2: Replace the balances placeholder in `app/g/[id]/page.tsx`**

Change the actions import to `import { addMember, deleteExpense, deleteMember, recordPayment, renameMember } from '@/app/actions';` and add:

```tsx
import { balances, settle } from '@/lib/split';
```

Replace `{tab === 'balances' && <p>Số dư (Task 6)</p>}` with:

```tsx
      {tab === 'balances' && <BalancesTab data={data} />}
```

Append:

```tsx
function BalancesTab({ data }: { data: GroupData }) {
  const id = data.group.id;
  const name = new Map(data.members.map((m) => [m.id, m.name]));
  const bal = balances(data.expenses);
  const transfers = settle(bal);
  return (
    <div className="space-y-4">
      <div className="card space-y-2">
        {data.members.map((m) => {
          const v = bal.get(m.id) ?? 0;
          return (
            <div key={m.id} className="flex justify-between">
              <span>{m.name}</span>
              <span className={v > 0 ? 'text-emerald-700' : v < 0 ? 'text-red-600' : 'text-gray-500'}>
                {v > 0 ? '+' : ''}
                {formatVnd(v)}
              </span>
            </div>
          );
        })}
      </div>
      <h2 className="font-semibold">Cách trả nợ</h2>
      {transfers.length === 0 && <p className="text-gray-500">Mọi người đã cân bằng 🎉</p>}
      {transfers.map((t) => (
        <div key={`${t.from}-${t.to}`} className="card flex items-center gap-3">
          <div className="flex-1">
            <b>{name.get(t.from)}</b> → <b>{name.get(t.to)}</b>
            <div className="font-semibold">{formatVnd(t.amount)}</div>
          </div>
          <form action={recordPayment.bind(null, id, t.from, t.to, t.amount)}>
            <button className="btn">Đã trả</button>
          </form>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Type-check, lint, unit tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: no errors, all tests PASS.

- [ ] **Step 4: Manual check**

With the expenses left from Task 5 ("Ăn tối" 300.000 paid by An, split equally among 3; "Cafe" 90.000 paid by Chi, 30.000 each):
- Expected balances: An +170.000đ, Bình −130.000đ, Chi Ng −40.000đ.
- Settle list: "Bình → An 130.000đ", "Chi Ng → An 40.000đ".
- Click "Đã trả" (Paid) on both → stays on the "Số dư" (Balances) tab, all balances 0đ, "Mọi người đã cân bằng 🎉"; the "Khoản chi" (Expenses) tab shows two "Thanh toán" (Payment) entries.

- [ ] **Step 5: Commit**

```bash
git add app
git commit -m "feat: show balances, settle-up list and record payments"
```

---

### Task 7: README, production build, end-to-end check

**Files:**
- Modify (replace): `README.md`

- [ ] **Step 1: Replace `README.md`**

````markdown
# Quick Split

Fast group expense splitting: create a group, send the link, and anyone with the link can add expenses. Supports equal, exact-amount and share-based splits; computes balances and a settle-up plan with the fewest transfers.

## Run locally

```bash
docker run -d --name quick-split-pg -e POSTGRES_PASSWORD=pg -e POSTGRES_DB=quicksplit -p 5432:5432 postgres:17
echo 'DATABASE_URL=postgres://postgres:pg@localhost:5432/quicksplit' > .env.local
npm install
npm run db:push
npm run dev
```

Test: `npm test`

## Deploy (Vercel + Neon)

1. Create a project at https://neon.tech and copy the **pooled** connection string (contains `-pooler` and `?sslmode=require`).
2. Create the tables: `DATABASE_URL='<neon-url>' npx drizzle-kit push`
3. Push the repo to GitHub, import it at https://vercel.com/new, add env `DATABASE_URL=<neon-url>`, Deploy.

Note: anyone with a group link can edit its data, so don't post the link publicly.
````

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds; route list includes `/`, `/g/[id]`, `/g/[id]/expense/new`, `/g/[id]/expense/[eid]`.

- [ ] **Step 3: Full end-to-end run on a fresh group (browser)**

`npm run start`, open `http://localhost:3000`, create group "E2E" with An / Bình / Chi, replay Task 5 step 6 items 1 and 3 and Task 6 step 4; every expected value must match (with "Chi" instead of "Chi Ng"). Then open the same group link in a second tab, add an expense there, reload the first tab → it appears.

- [ ] **Step 4: Tampering check (Review Focus #5)**

Create a second group "Other" (X, Y), add one expense, read its id from its edit URL `/g/<Other id>/expense/<eid>`. Open `/g/<E2E id>/expense/<eid>` → "Không tìm thấy nhóm này" 404 page, and the E2E group's lists are unchanged. (Write paths are protected by the `groupId` filter in `writeExpense`, `deleteExpense`, `renameMember`, `deleteMember` and the member-in-group check in `writeExpense`.)

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add README with local run and deploy steps"
```

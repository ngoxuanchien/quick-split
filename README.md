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

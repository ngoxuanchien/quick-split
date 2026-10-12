# Quick Split

Chia tiền nhóm nhanh: tạo nhóm, gửi link, ai có link cũng thêm khoản chi được. Hỗ trợ chia đều, theo số tiền, theo phần; tính số dư và cách trả nợ ít giao dịch.

## Chạy local

```bash
docker run -d --name quick-split-pg -e POSTGRES_PASSWORD=pg -e POSTGRES_DB=quicksplit -p 5432:5432 postgres:17
echo 'DATABASE_URL=postgres://postgres:pg@localhost:5432/quicksplit' > .env.local
npm install
npm run db:push
npm run dev
```

Test: `npm test`

## Deploy (Vercel + Neon)

1. Tạo project trên https://neon.tech, copy **pooled** connection string (có `-pooler` và `?sslmode=require`).
2. Tạo bảng: `DATABASE_URL='<neon-url>' npx drizzle-kit push`
3. Push repo lên GitHub, import vào https://vercel.com/new, thêm env `DATABASE_URL=<neon-url>`, Deploy.

Lưu ý: ai có link nhóm đều sửa được dữ liệu, đừng đăng link công khai.

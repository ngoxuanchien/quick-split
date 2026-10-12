import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile('.env.local');
} catch {} // absent on Vercel/CI, where DATABASE_URL is set in the environment

export default defineConfig({
  schema: './db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});

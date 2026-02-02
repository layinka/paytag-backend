import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schemas/index.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || './data/paytag.sqlite',
  },
  verbose: true,
  strict: true,
});

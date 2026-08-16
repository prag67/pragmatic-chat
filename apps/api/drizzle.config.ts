import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://pragmatic:pragmatic@localhost:5433/pragmatic',
  },
  verbose: true,
  strict: true,
});

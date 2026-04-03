import { defineConfig } from 'prisma/config';
import 'dotenv/config';

/**
 * Prisma 7 configuration.
 *
 * In Prisma 7, connection URLs are defined here — NOT in schema.prisma.
 * See: https://pris.ly/d/config-datasource
 *
 * URL strategy:
 *   DIRECT_URL  — port 5432, bypasses PgBouncer entirely.
 *                 Used for all CLI operations: db push, migrate, validate.
 *                 PgBouncer (transaction mode) does NOT support the extended
 *                 query protocol required for schema migrations.
 *
 *   DATABASE_URL — port 6543, PgBouncer transaction mode.
 *                  Used at runtime by the PrismaPg driver adapter in
 *                  src/lib/prisma.ts. NOT read by Prisma CLI at all.
 *
 * dotenv/config loads .env from the current working directory (project root
 * when running `npx prisma db push` or `npx prisma generate`). It does NOT
 * load .env.local — that is a Next.js convention, not a dotenv convention.
 */
export default defineConfig({
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
});

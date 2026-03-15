import { defineConfig } from 'prisma/config';
import 'dotenv/config';

/**
 * Prisma 7 configuration.
 * Connection URLs live here (not in schema.prisma) per Prisma v7 spec.
 * The DIRECT_URL bypasses PgBouncer for migrations/db push.
 */
export default defineConfig({
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
});

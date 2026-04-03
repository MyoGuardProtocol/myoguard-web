import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Prevent multiple PrismaClient instances during Next.js hot reloads in dev
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * Prisma 7 uses database driver adapters rather than embedding the connection
 * URL in schema.prisma. At runtime (Next.js server) we connect via the
 * pooled Supabase PgBouncer URL (DATABASE_URL).
 *
 * Key settings:
 * - connectionTimeoutMillis: 8 000 ms — fail fast instead of hanging 30+ s.
 *   Without this, the default pg timeout is effectively infinite on unreachable
 *   hosts, causing the dashboard (and any DB-dependent route) to stall until
 *   the OS TCP timeout fires (~60-90 s), which renders as a 503/504.
 * - idleTimeoutMillis / max: keep the pool small for serverless/dev use.
 * - ssl.rejectUnauthorized: false — Supabase pooler requires SSL but its cert
 *   chain may not be trusted by the Node.js CA bundle on some hosts.
 */
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to your .env file. See .env.example."
    );
  }

  // Create an explicit Pool instance rather than passing a bare PoolConfig to
  // PrismaPg.  When PrismaPg receives a PoolConfig it creates a Pool internally
  // via its own code path, which in @prisma/adapter-pg v7 can trigger the
  // pg@8 deprecation warning:
  //   "Calling client.query() when the client is already executing a query"
  // This fires when the adapter's internally-created Pool initialises a
  // connection and the adapter calls client.query() before the previous
  // setup call on that client has resolved.
  //
  // Passing an explicit Pool gives the adapter a stable, user-managed pool
  // and avoids the internal initialisation race.  pg is a peer dependency of
  // @prisma/adapter-pg (not a bundled copy), so Pool from the top-level
  // "pg" package is type-compatible with what the adapter expects.
  const pool = new Pool({
    connectionString,
    ssl:                    { rejectUnauthorized: false },
    connectionTimeoutMillis: 8_000,   // fail fast — don't hang the request
    idleTimeoutMillis:       10_000,
    max:                     5,       // small pool for dev / serverless
  });

  const adapter = new PrismaPg(pool as Parameters<typeof PrismaPg>[0]);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  } as ConstructorParameters<typeof PrismaClient>[0]);
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

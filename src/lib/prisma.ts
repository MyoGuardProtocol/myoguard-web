import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prevent multiple PrismaClient instances during Next.js hot reloads in dev
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * Prisma 7 uses database driver adapters rather than embedding the connection
 * URL in schema.prisma. At runtime (Next.js server) we connect via the
 * pooled Supabase PgBouncer URL (DATABASE_URL).
 */
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to your .env file. See .env.example."
    );
  }

  const adapter = new PrismaPg({ connectionString });

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

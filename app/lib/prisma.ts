/**
 * Compatibility re-export.
 * Sprint 2/3 routes import from "@/app/lib/prisma".
 * The canonical Prisma singleton (Prisma 7 + PrismaPg adapter) lives at
 * "@/src/lib/prisma". This file re-exports it so both import paths work.
 */
export { prisma } from "@/src/lib/prisma";

/* eslint-disable @typescript-eslint/no-require-imports */
const globalForPrisma = globalThis as any

if (!globalForPrisma.prisma) {
  const { PrismaClient } = require("@prisma/client")
  globalForPrisma.prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
  })
}

export const prisma = globalForPrisma.prisma

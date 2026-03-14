/* eslint-disable @typescript-eslint/no-explicit-any */
const globalForPrisma = globalThis as any

if (!globalForPrisma.prisma) {
  const { PrismaClient } = require("@prisma/client")
  globalForPrisma.prisma = new PrismaClient()
}

export const prisma = globalForPrisma.prisma

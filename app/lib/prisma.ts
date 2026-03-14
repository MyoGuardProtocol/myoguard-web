/* eslint-disable @typescript-eslint/no-require-imports */
const globalForPrisma = globalThis as any

  const { PrismaClient } = require("@prisma/client")
  globalForPrisma.prisma = new PrismaClient()
}

export const prisma = globalForPrisma.prisma

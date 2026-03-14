// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client")
const g = globalThis as any
export const prisma = g.prisma || (g.prisma = new PrismaClient())

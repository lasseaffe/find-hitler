import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

export const prisma =
  globalForPrisma.prisma ??
  (globalForPrisma.prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
  }))

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis

function createClient() {
  if (!process.env.DATABASE_URL) {
    // Surfaced only when a query is actually attempted (auth/ranked/profile),
    // so the app still builds + boots with no database (solo + multiplayer work).
    throw new Error('DATABASE_URL is not set — auth, ranked, and profile require a Postgres database.')
  }
  // Prisma 7 `client` engine has no built-in connector; the pg adapter opens the connection.
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter })
}

// Lazy singleton via Proxy: PrismaClient is NOT instantiated at import time, so a
// missing DATABASE_URL can't crash `next build` or server boot. It's created on the
// first real property access (e.g. prisma.user.findUnique).
export const prisma = new Proxy(
  {},
  {
    get(_target, prop) {
      if (!globalForPrisma.prisma) globalForPrisma.prisma = createClient()
      const client = globalForPrisma.prisma
      const value = client[prop]
      return typeof value === 'function' ? value.bind(client) : value
    },
  }
)

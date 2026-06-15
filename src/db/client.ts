import { createPrismaClient } from "@/db/prisma-client"

type GlobalPrismaState = {
  prisma?: ReturnType<typeof createPrismaClient>
}

const globalForPrisma = globalThis as typeof globalThis & GlobalPrismaState

const prismaClient = globalForPrisma.prisma ?? createPrismaClient({
  log: ["error"],
})

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaClient
}

export const prisma = prismaClient
export const db = prisma

import { PrismaClient } from "@prisma/client"

type PrismaClientOptions = NonNullable<ConstructorParameters<typeof PrismaClient>[0]>
type PrismaPgConstructor = new (config: { connectionString: string }) => PrismaClientOptions["adapter"]

function readDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim()

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to create PrismaClient")
  }

  return databaseUrl
}

function loadPrismaPg() {
  const requireFunc = eval("require") as NodeRequire
  const adapterModule = requireFunc("@prisma/adapter-pg") as {
    PrismaPg: PrismaPgConstructor
  }

  return adapterModule.PrismaPg
}

export function createPrismaClient(options: Omit<PrismaClientOptions, "adapter"> = {}) {
  const PrismaPg = loadPrismaPg()
  const adapter = new PrismaPg({
    connectionString: readDatabaseUrl(),
  })

  return new PrismaClient({
    ...options,
    adapter,
  })
}

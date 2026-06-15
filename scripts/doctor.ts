import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { Socket } from "node:net"
import { resolve } from "node:path"
import { config as loadDotenv } from "dotenv"

type CheckStatus = "pass" | "warn" | "fail"

interface CheckResult {
  name: string
  status: CheckStatus
  message: string
  hint?: string
}

const envFilePath = resolve(process.cwd(), ".env")
const envExamplePath = resolve(process.cwd(), ".env.example")

loadDotenv({ path: envFilePath })

function readEnv(key: string) {
  const value = process.env[key]
  return typeof value === "string" ? value.trim() : ""
}

function commandOutput(command: string, args: string[] = []) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "pipe",
  })

  return {
    ok: result.status === 0,
    text: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  }
}

function parseMajorVersion(raw: string) {
  const match = raw.match(/v?(\d+)/)
  return match ? Number(match[1]) : null
}

function checkNode(): CheckResult {
  const major = parseMajorVersion(process.version)

  if (major !== null && major >= 20) {
    return {
      name: "Node.js",
      status: "pass",
      message: `Detected ${process.version}.`,
    }
  }

  return {
    name: "Node.js",
    status: "fail",
    message: `Detected ${process.version}; this project requires Node.js 20 or newer.`,
    hint: "Install Node.js 20+ and rerun this command.",
  }
}

function checkPnpm(): CheckResult {
  const result = commandOutput("corepack", ["pnpm", "--version"])

  if (result.ok) {
    return {
      name: "pnpm",
      status: "pass",
      message: `corepack pnpm ${result.text} is available.`,
    }
  }

  return {
    name: "pnpm",
    status: "fail",
    message: "corepack pnpm is not available.",
    hint: "Run `corepack enable`, then retry `corepack pnpm install --frozen-lockfile`.",
  }
}

function checkEnvFile(): CheckResult {
  if (existsSync(envFilePath)) {
    return {
      name: ".env",
      status: "pass",
      message: ".env exists.",
    }
  }

  const hint = existsSync(envExamplePath)
    ? "Copy `.env.example` to `.env`, then edit DATABASE_URL, SESSION_SECRET, CAPTCHA_SECRET_KEY and REDIS_URL."
    : "Create `.env` with DATABASE_URL, SESSION_SECRET, CAPTCHA_SECRET_KEY and REDIS_URL."

  return {
    name: ".env",
    status: "fail",
    message: ".env is missing.",
    hint,
  }
}

function checkRequiredEnv(key: string, description: string): CheckResult {
  const value = readEnv(key)

  if (!value) {
    return {
      name: key,
      status: "fail",
      message: `${description} is not configured.`,
    }
  }

  if (/replace-with|changeme/i.test(value)) {
    return {
      name: key,
      status: "fail",
      message: `${description} still uses a placeholder value.`,
      hint: "Replace it with a real value before running setup or production.",
    }
  }

  return {
    name: key,
    status: "pass",
    message: `${description} is configured.`,
  }
}

function parseUrl(value: string) {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function checkPostgresUrl(): CheckResult {
  const value = readEnv("DATABASE_URL")
  if (!value) {
    return checkRequiredEnv("DATABASE_URL", "PostgreSQL connection string")
  }

  const parsed = parseUrl(value)
  if (!parsed || !parsed.protocol.startsWith("postgres")) {
    return {
      name: "DATABASE_URL",
      status: "fail",
      message: "DATABASE_URL must be a PostgreSQL connection string.",
      hint: 'Example: DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bbs?schema=public"',
    }
  }

  return {
    name: "DATABASE_URL",
    status: "pass",
    message: `PostgreSQL URL points to ${parsed.hostname}:${parsed.port || "5432"}.`,
  }
}

function checkRedisUrl(): CheckResult {
  const value = readEnv("REDIS_URL")
  if (!value) {
    return checkRequiredEnv("REDIS_URL", "Redis connection string")
  }

  const parsed = parseUrl(value)
  if (!parsed || parsed.protocol !== "redis:") {
    return {
      name: "REDIS_URL",
      status: "fail",
      message: "REDIS_URL must be a Redis connection string.",
      hint: 'Example: REDIS_URL="redis://127.0.0.1:6379"',
    }
  }

  return {
    name: "REDIS_URL",
    status: "pass",
    message: `Redis URL points to ${parsed.hostname}:${parsed.port || "6379"}.`,
  }
}

function tcpCheck(name: string, urlValue: string, fallbackPort: number): Promise<CheckResult> {
  const parsed = parseUrl(urlValue)
  if (!parsed) {
    return Promise.resolve({
      name,
      status: "fail",
      message: `${name} URL cannot be parsed.`,
    })
  }

  const host = parsed.hostname
  const port = Number(parsed.port || fallbackPort)

  return new Promise((resolveCheck) => {
    const socket = new Socket()
    let settled = false

    function finish(status: CheckStatus, message: string, hint?: string) {
      if (settled) {
        return
      }
      settled = true
      socket.destroy()
      resolveCheck({ name, status, message, hint })
    }

    socket.setTimeout(1500)
    socket.once("connect", () => finish("pass", `${host}:${port} accepts TCP connections.`))
    socket.once("timeout", () => finish("fail", `${host}:${port} did not respond before timeout.`, runtimeServiceHint(name)))
    socket.once("error", (error: NodeJS.ErrnoException) => {
      const detail = error.message || error.code || String(error)
      finish("fail", `${host}:${port} is not reachable: ${detail}`, runtimeServiceHint(name))
    })
    socket.connect(port, host)
  })
}

function runtimeServiceHint(name: string) {
  if (name === "PostgreSQL") {
    return "Start PostgreSQL, or install Docker Desktop and run `docker compose up -d postgres redis`."
  }

  if (name === "Redis") {
    return "Start Redis, or install Docker Desktop and run `docker compose up -d postgres redis`."
  }

  return undefined
}

function checkDocker(): CheckResult {
  const result = commandOutput("docker", ["--version"])

  if (result.ok) {
    return {
      name: "Docker",
      status: "pass",
      message: result.text,
    }
  }

  return {
    name: "Docker",
    status: "warn",
    message: "Docker was not found.",
    hint: "Docker is optional, but it is the easiest way to run PostgreSQL and Redis locally.",
  }
}

async function checkPrismaEngine(): Promise<CheckResult> {
  if (!readEnv("DATABASE_URL")) {
    return {
      name: "Prisma engine",
      status: "warn",
      message: "Skipped because DATABASE_URL is not configured.",
    }
  }

  const { createPrismaClient } = await import("../src/db/prisma-client")
  const prisma = createPrismaClient({ log: [] })

  try {
    await prisma.$queryRaw`SELECT 1`
    return {
      name: "Prisma engine",
      status: "pass",
      message: "Prisma Client loaded and executed a test query successfully.",
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    const engineLooksBroken =
      detail.includes("Unable to require")
      || detail.includes("not a valid Win32 application")
      || detail.includes("system requirements")
      || detail.includes("Prisma engines do not seem to be compatible")

    if (engineLooksBroken) {
      return {
        name: "Prisma engine",
        status: "fail",
        message: "Prisma engine is not compatible with this machine.",
        hint: "Run `corepack pnpm run prisma:generate`. If it still fails, reinstall dependencies on this machine.",
      }
    }

    return {
      name: "Prisma engine",
      status: "pass",
      message: "Prisma Client loaded; database connectivity is checked separately.",
    }
  } finally {
    await prisma.$disconnect().catch(() => undefined)
  }
}

function formatStatus(status: CheckStatus) {
  if (status === "pass") {
    return "PASS"
  }
  if (status === "warn") {
    return "WARN"
  }
  return "FAIL"
}

function printResults(results: CheckResult[]) {
  for (const result of results) {
    console.log(`[${formatStatus(result.status)}] ${result.name}: ${result.message}`)
    if (result.hint) {
      console.log(`       ${result.hint}`)
    }
  }
}

async function main() {
  const results: CheckResult[] = [
    checkNode(),
    checkPnpm(),
    checkEnvFile(),
    checkPostgresUrl(),
    checkRequiredEnv("SESSION_SECRET", "Session secret"),
    checkRequiredEnv("CAPTCHA_SECRET_KEY", "Captcha secret"),
    checkRedisUrl(),
    checkDocker(),
  ]

  results.push(await checkPrismaEngine())

  const databaseUrl = readEnv("DATABASE_URL")
  const redisUrl = readEnv("REDIS_URL")

  if (databaseUrl) {
    results.push(await tcpCheck("PostgreSQL", databaseUrl, 5432))
  }

  if (redisUrl) {
    results.push(await tcpCheck("Redis", redisUrl, 6379))
  }

  printResults(results)

  const failures = results.filter((result) => result.status === "fail")

  if (failures.length > 0) {
    console.log("")
    console.log(`Runtime check failed with ${failures.length} blocker(s). Fix them before running \`pnpm run setup\` or \`pnpm run dev\`.`)
    process.exit(1)
  }

  console.log("")
  console.log("Runtime check passed. You can run `pnpm run setup`, then `pnpm run dev`.")
}

void main()

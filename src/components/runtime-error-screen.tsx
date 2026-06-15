"use client"

import Link from "next/link"
import { Home, RefreshCw } from "lucide-react"

interface RuntimeErrorScreenProps {
  error?: Error & { digest?: string }
  reset?: () => void
  title?: string
}

function getRuntimeHint(error?: Error) {
  const message = error?.message ?? ""

  if (
    message.includes("DATABASE_URL")
    || message.includes("Can't reach database server")
    || message.includes("Prisma")
    || message.includes("P1001")
  ) {
    return "当前应用已启动，但 PostgreSQL 数据库不可用。请先启动 PostgreSQL，然后执行 pnpm run setup。"
  }

  if (message.includes("REDIS_URL") || message.includes("Redis") || message.includes("ECONNREFUSED")) {
    return "当前应用已启动，但 Redis 不可用。请先启动 Redis，再刷新页面。"
  }

  return "应用运行时遇到错误。请先执行 pnpm run doctor 查看本机环境状态。"
}

export function RuntimeErrorScreen({
  error,
  reset,
  title = "应用暂时不可用",
}: RuntimeErrorScreenProps) {
  const hint = getRuntimeHint(error)

  return (
    <main className="min-h-screen bg-background px-4 py-16 text-foreground">
      <section className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col justify-center">
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">Runtime Error</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-normal sm:text-4xl">{title}</h1>
        <p className="mt-4 text-base leading-8 text-muted-foreground">{hint}</p>

        {error?.digest ? (
          <p className="mt-4 rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            错误编号：{error.digest}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          {reset ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              <RefreshCw className="h-4 w-4" />
              重试
            </button>
          ) : null}
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium transition hover:bg-accent"
          >
            <Home className="h-4 w-4" />
            返回首页
          </Link>
        </div>

        <div className="mt-8 rounded-md border border-border bg-card p-4 text-sm leading-7 text-muted-foreground">
          <p>本地开发顺序：</p>
          <p>1. 启动 PostgreSQL 和 Redis。</p>
          <p>2. 运行 corepack pnpm run doctor。</p>
          <p>3. 运行 corepack pnpm run setup。</p>
          <p>4. 运行 corepack pnpm run dev。</p>
        </div>
      </section>
    </main>
  )
}

"use client"

import { useEffect } from "react"

import { RuntimeErrorScreen } from "@/components/runtime-error-screen"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[app/global-error]", error)
  }, [error])

  return (
    <html lang="zh-CN">
      <body>
        <RuntimeErrorScreen error={error} reset={reset} title="应用启动失败" />
      </body>
    </html>
  )
}

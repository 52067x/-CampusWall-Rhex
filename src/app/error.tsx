"use client"

import { useEffect } from "react"

import { RuntimeErrorScreen } from "@/components/runtime-error-screen"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[app/error]", error)
  }, [error])

  return <RuntimeErrorScreen error={error} reset={reset} />
}

"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

type TargetType = "post" | "comment"

interface ModerationResult {
  decision: "PASS" | "REVIEW" | "REJECT"
  riskLevel: "LOW" | "MEDIUM" | "HIGH"
  categories: string[]
  reason: string
  suggestedAction: string
  mode: "rules" | "ai" | "hybrid"
  aiConfigured: boolean
  aiError?: string
  confidence?: number
}

interface ApiResponse {
  code: number
  message?: string
  data?: {
    result: ModerationResult
    applied: boolean
    applyMessage: string | null
  }
}

interface AdminCampusAiModerationButtonProps {
  targetType: TargetType
  targetId: string
  title: string
  className?: string
  hideTrigger?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function getDecisionLabel(decision: ModerationResult["decision"]) {
  if (decision === "REJECT") return "拒绝"
  if (decision === "REVIEW") return "人工复核"
  return "通过"
}

function getDecisionClassName(decision: ModerationResult["decision"]) {
  if (decision === "REJECT") return "border-transparent bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200"
  if (decision === "REVIEW") return "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
  return "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
}

export function AdminCampusAiModerationButton({
  targetType,
  targetId,
  title,
  className,
  hideTrigger = false,
  open: controlledOpen,
  onOpenChange,
}: AdminCampusAiModerationButtonProps) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const [result, setResult] = useState<ModerationResult | null>(null)
  const [isPending, startTransition] = useTransition()
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  const setOpen = useCallback((nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
    if (!nextOpen) {
      setResult(null)
    }
  }, [isControlled, onOpenChange])

  const check = useCallback((apply: boolean) => {
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/apps/campus-ai-moderation/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetType, targetId, apply }),
        })
        const json = await response.json().catch(() => null) as ApiResponse | null
        if (!response.ok || !json || json.code !== 0 || !json.data) {
          toast.error(json?.message ?? "AI 审核失败")
          return
        }

        setResult(json.data.result)
        toast.success(json.message ?? "AI 审核完成")
        if (apply) {
          router.refresh()
        }
      } catch (error) {
        console.error(error)
        toast.error("AI 审核失败")
      }
    })
  }, [router, targetId, targetType])

  useEffect(() => {
    if (open && !result && !isPending) {
      check(false)
    }
  }, [check, isPending, open, result])

  return (
    <>
      {!hideTrigger ? (
        <Button
          type="button"
          variant="outline"
          className={className ?? "h-7 rounded-full px-2.5 text-xs"}
          disabled={isPending}
          onClick={() => setOpen(true)}
        >
          {isPending ? "审核中..." : "AI 审核"}
        </Button>
      ) : null}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="AI 审核"
        description={`${targetType === "post" ? "帖子" : "评论"}：${title}`}
        footer={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" className="h-9 px-4 text-xs" disabled={isPending} onClick={() => check(false)}>
              重新检测
            </Button>
            <Button type="button" className="h-9 px-4 text-xs" disabled={isPending || !result} onClick={() => check(true)}>
              检测并自动处理
            </Button>
            <Button type="button" variant="ghost" className="h-9 px-3 text-xs" onClick={() => setOpen(false)}>
              关闭
            </Button>
          </div>
        )}
      >
        {result ? (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge className={getDecisionClassName(result.decision)}>{getDecisionLabel(result.decision)}</Badge>
              <Badge variant="outline">{result.riskLevel}</Badge>
              <Badge variant="outline">{result.mode === "ai" ? "AI" : result.mode === "hybrid" ? "AI+规则" : "规则"}</Badge>
              {typeof result.confidence === "number" ? <Badge variant="outline">置信度 {Math.round(result.confidence * 100)}%</Badge> : null}
            </div>
            {result.categories.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {result.categories.map((category) => (
                  <span key={category} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {category}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="font-medium">审核原因</p>
              <p className="mt-1 leading-6 text-muted-foreground">{result.reason}</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="font-medium">建议动作</p>
              <p className="mt-1 leading-6 text-muted-foreground">{result.suggestedAction}</p>
            </div>
            {!result.aiConfigured ? (
              <p className="text-xs text-muted-foreground">当前未配置模型密钥，已使用本地规则审核。可在 AI 助手后台配置 OpenAI 兼容接口后启用大模型复核。</p>
            ) : result.aiError ? (
              <p className={cn("text-xs", "text-amber-600 dark:text-amber-300")}>AI 调用异常：{result.aiError}，本次已保留规则审核结果。</p>
            ) : null}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">{isPending ? "AI 审核中..." : "等待检测"}</div>
        )}
      </Modal>
    </>
  )
}


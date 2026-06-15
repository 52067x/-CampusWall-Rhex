"use client"

import { useState, useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"

type TargetType = "post" | "comment" | "text"

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
  sensitiveHits: Array<{ word: string; actionType: string }>
}

interface CheckResponse {
  code: number
  message?: string
  data?: {
    target: {
      targetType: TargetType
      targetId: string | null
      currentStatus: string | null
      title: string
      content: string
    }
    result: ModerationResult
    applied: boolean
    applyMessage: string | null
  }
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

export function CampusAiModerationPage() {
  const [targetType, setTargetType] = useState<TargetType>("post")
  const [targetId, setTargetId] = useState("")
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [data, setData] = useState<CheckResponse["data"] | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit(apply: boolean) {
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/apps/campus-ai-moderation/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetType,
            targetId,
            title,
            content,
            apply,
          }),
        })
        const json = await response.json().catch(() => null) as CheckResponse | null
        if (!response.ok || !json || json.code !== 0 || !json.data) {
          toast.error(json?.message ?? "AI 审核失败")
          return
        }
        setData(json.data)
        toast.success(json.message ?? "AI 审核完成")
      } catch (error) {
        console.error(error)
        toast.error("AI 审核失败")
      }
    })
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>内容检测</CardTitle>
          <CardDescription>检测帖子、评论或临时文本；自动处理只会把风险内容转入待审、下线或隐藏。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block text-sm font-medium">
            <span>检测对象</span>
            <select
              value={targetType}
              onChange={(event) => setTargetType(event.target.value as TargetType)}
              className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="post">帖子 ID</option>
              <option value="comment">评论 ID</option>
              <option value="text">临时文本</option>
            </select>
          </label>

          {targetType !== "text" ? (
            <label className="block text-sm font-medium">
              <span>{targetType === "post" ? "帖子 ID" : "评论 ID"}</span>
              <Input value={targetId} onChange={(event) => setTargetId(event.target.value)} className="mt-2" placeholder="粘贴后台列表中的内容 ID" />
            </label>
          ) : (
            <>
              <label className="block text-sm font-medium">
                <span>标题</span>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2" placeholder="可选" />
              </label>
              <label className="block text-sm font-medium">
                <span>正文</span>
                <Textarea value={content} onChange={(event) => setContent(event.target.value)} className="mt-2 min-h-[180px]" placeholder="输入需要审核的文本" />
              </label>
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={isPending} onClick={() => submit(false)}>
              {isPending ? "检测中..." : "仅检测"}
            </Button>
            <Button type="button" variant="outline" disabled={isPending || targetType === "text"} onClick={() => submit(true)}>
              检测并自动处理
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>审核结果</CardTitle>
          <CardDescription>AI 模型未配置时自动使用本地规则；配置模型后会进行大模型复核。</CardDescription>
        </CardHeader>
        <CardContent>
          {data ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge className={getDecisionClassName(data.result.decision)}>{getDecisionLabel(data.result.decision)}</Badge>
                <Badge variant="outline">{data.result.riskLevel}</Badge>
                <Badge variant="outline">{data.result.mode === "hybrid" ? "AI+规则" : data.result.mode === "ai" ? "AI" : "规则"}</Badge>
                {data.target.currentStatus ? <Badge variant="outline">当前状态 {data.target.currentStatus}</Badge> : null}
                {typeof data.result.confidence === "number" ? <Badge variant="outline">置信度 {Math.round(data.result.confidence * 100)}%</Badge> : null}
              </div>

              {data.result.categories.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {data.result.categories.map((category) => (
                    <span key={category} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{category}</span>
                  ))}
                </div>
              ) : null}

              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium">原因</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{data.result.reason}</p>
              </div>

              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium">建议动作</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{data.result.suggestedAction}</p>
              </div>

              {data.applied ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                  {data.applyMessage}
                </div>
              ) : null}

              {!data.result.aiConfigured ? (
                <p className="text-xs text-muted-foreground">当前未配置模型接口，系统已使用本地规则完成检测。</p>
              ) : data.result.aiError ? (
                <p className="text-xs text-amber-600 dark:text-amber-300">AI 调用异常：{data.result.aiError}</p>
              ) : null}
            </div>
          ) : (
            <div className="py-16 text-center text-sm text-muted-foreground">暂无检测结果</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


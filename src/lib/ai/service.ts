import "server-only"

import { getRateLimitConfig } from "@/lib/ai/capabilities/rate-limit-config"
import { checkAndIncrementDaily } from "@/lib/ai/rate-limit"

import type {
  AiChatMessage,
  AiChatOptions,
  AiProvider,
} from "./provider/types"

export type AiTaskKind = "reply" | "summary" | "auto-categorize" | "chat"

export interface RunAiTaskInput {
  kind: AiTaskKind
  provider: AiProvider
  messages: AiChatMessage[]
  options: AiChatOptions
  /** 用于按业务能力隔离每日调用限额。 */
  appKey: string
}

export interface RunAiTaskOutput {
  text: string
  finishReason?: string
  usage?: { totalTokens?: number }
}

/**
 * 统一任务编排外壳：在调用 provider 前执行公共限额检查，并透传 token usage。
 */
export async function runAiTask(input: RunAiTaskInput): Promise<RunAiTaskOutput> {
  const { dailyMax } = await getRateLimitConfig()
  await checkAndIncrementDaily(input.appKey, dailyMax)
  void input.kind

  const res = await input.provider.chat(input.messages, input.options)
  return {
    text: res.text,
    finishReason: res.finishReason,
    usage: { totalTokens: res.usage?.totalTokens },
  }
}

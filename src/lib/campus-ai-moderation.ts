import "server-only"

import { prisma } from "@/db/client"
import { apiError } from "@/lib/api-route"
import { getServerAiReplyConfig } from "@/lib/ai-reply-config"
import { OpenAiCompatibleProvider } from "@/lib/ai/provider/openai-compatible"
import type { SensitiveScene } from "@/lib/content-safety"
import { scanSensitiveText } from "@/lib/content-safety"

export type CampusModerationTargetType = "post" | "comment" | "text"
export type CampusModerationDecision = "PASS" | "REVIEW" | "REJECT"
export type CampusModerationRiskLevel = "LOW" | "MEDIUM" | "HIGH"
export type CampusModerationMode = "rules" | "ai" | "hybrid"

export interface CampusModerationInput {
  targetType: CampusModerationTargetType
  title?: string | null
  content: string
}

export interface CampusModerationResult {
  decision: CampusModerationDecision
  riskLevel: CampusModerationRiskLevel
  categories: string[]
  reason: string
  suggestedAction: string
  mode: CampusModerationMode
  aiConfigured: boolean
  aiError?: string
  confidence?: number
  sensitiveHits: Array<{
    scene: SensitiveScene
    word: string
    actionType: string
  }>
}

type RuleMatch = {
  decision: CampusModerationDecision
  riskLevel: CampusModerationRiskLevel
  category: string
  reason: string
}

const DECISION_WEIGHT: Record<CampusModerationDecision, number> = {
  PASS: 0,
  REVIEW: 1,
  REJECT: 2,
}

const RISK_WEIGHT: Record<CampusModerationRiskLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
}

const LOCAL_POLICY_RULES: Array<{
  category: string
  decision: CampusModerationDecision
  riskLevel: CampusModerationRiskLevel
  pattern: RegExp
  reason: string
}> = [
  {
    category: "违法违规",
    decision: "REJECT",
    riskLevel: "HIGH",
    pattern: /(代开|买卖|出售).{0,8}(发票|银行卡|身份证|学生证|公章)|办假证|套现|洗钱|跑分/u,
    reason: "内容疑似涉及违法交易或身份、票据造假。",
  },
  {
    category: "诈骗赌博",
    decision: "REJECT",
    riskLevel: "HIGH",
    pattern: /(博彩|赌博|网赌|时时彩|百家乐|送彩金|刷单返利|杀猪盘|裸聊敲诈|资金盘|传销)/u,
    reason: "内容疑似涉及赌博、诈骗或非法牟利。",
  },
  {
    category: "涉黄低俗",
    decision: "REJECT",
    riskLevel: "HIGH",
    pattern: /(约炮|裸聊|援交|卖淫|嫖娼|成人视频|色情网|黄色资源|上门服务)/u,
    reason: "内容疑似涉及色情低俗或非法性交易。",
  },
  {
    category: "暴力恐怖",
    decision: "REJECT",
    riskLevel: "HIGH",
    pattern: /(炸学校|投毒|砍人|杀人|自制炸弹|恐怖袭击|爆炸物|枪支弹药)/u,
    reason: "内容疑似涉及暴力恐怖、伤害威胁或危险物品。",
  },
  {
    category: "毒品违禁",
    decision: "REJECT",
    riskLevel: "HIGH",
    pattern: /(冰毒|海洛因|大麻|摇头丸|K粉|麻古|贩毒|吸毒|迷药)/iu,
    reason: "内容疑似涉及毒品或违禁药物。",
  },
  {
    category: "隐私泄露",
    decision: "REVIEW",
    riskLevel: "MEDIUM",
    pattern: /(\d{17}[\dXx])|(\d{6}(19|20)\d{2}(0[1-9]|1[0-2])\d{2}\d{3}[\dXx])|(身份证|宿舍号|家庭住址|手机号).{0,20}(曝光|挂人|人肉|开盒)/u,
    reason: "内容可能包含个人敏感信息或指向人肉、曝光行为。",
  },
  {
    category: "人身攻击",
    decision: "REVIEW",
    riskLevel: "MEDIUM",
    pattern: /(傻逼|煞笔|脑残|去死|滚蛋|贱人|废物|垃圾人|挂人|避雷).{0,20}(@|\d|同学|老师|辅导员)?/u,
    reason: "内容可能包含辱骂、人身攻击或校园冲突升级风险。",
  },
  {
    category: "违规引流",
    decision: "REVIEW",
    riskLevel: "MEDIUM",
    pattern: /(加我微信|加微信|私加|QQ群|微信群|VX|v信|微信号|二维码|扫码进群|外部链接|返现群|兼职群)/iu,
    reason: "内容可能涉及微信小程序规范中的外部引流或诱导加群。",
  },
  {
    category: "商业广告",
    decision: "REVIEW",
    riskLevel: "MEDIUM",
    pattern: /(低价代写|论文代写|代课|代签到|代考|代刷|兼职日结|无门槛兼职|校园贷|贷款秒批)/u,
    reason: "内容可能涉及违规广告、学术不端或校园贷风险。",
  },
]

function normalizeText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : ""
}

function mergeDecision(left: CampusModerationDecision, right: CampusModerationDecision) {
  return DECISION_WEIGHT[right] > DECISION_WEIGHT[left] ? right : left
}

function mergeRisk(left: CampusModerationRiskLevel, right: CampusModerationRiskLevel) {
  return RISK_WEIGHT[right] > RISK_WEIGHT[left] ? right : left
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)))
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  if (!trimmed) {
    return null
  }

  const direct = tryParseJson(trimmed)
  if (direct) {
    return direct
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    const parsed = tryParseJson(fenced[1].trim())
    if (parsed) {
      return parsed
    }
  }

  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start >= 0 && end > start) {
    return tryParseJson(trimmed.slice(start, end + 1))
  }

  return null
}

function tryParseJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

function normalizeDecision(value: unknown): CampusModerationDecision {
  return value === "REJECT" || value === "REVIEW" || value === "PASS" ? value : "REVIEW"
}

function normalizeRisk(value: unknown): CampusModerationRiskLevel {
  return value === "HIGH" || value === "MEDIUM" || value === "LOW" ? value : "MEDIUM"
}

function normalizeConfidence(value: unknown) {
  const number = typeof value === "number" ? value : Number(value)
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : undefined
}

function toPlainContent(value: string) {
  const text = normalizeText(value)
  if (!text) {
    return ""
  }

  try {
    const parsed = JSON.parse(text) as { blocks?: Array<{ text?: string; content?: string }> }
    if (Array.isArray(parsed.blocks)) {
      const extracted = parsed.blocks
        .map((block) => block.text || block.content || "")
        .filter(Boolean)
        .join("\n")
        .trim()
      return extracted || text
    }
  } catch {
    // Plain text input.
  }

  return text
}

function findLocalPolicyMatches(text: string): RuleMatch[] {
  return LOCAL_POLICY_RULES
    .filter((rule) => rule.pattern.test(text))
    .map((rule) => ({
      decision: rule.decision,
      riskLevel: rule.riskLevel,
      category: rule.category,
      reason: rule.reason,
    }))
}

async function runRuleModeration(input: CampusModerationInput): Promise<CampusModerationResult> {
  const title = normalizeText(input.title)
  const content = toPlainContent(input.content)
  const combined = [title, content].filter(Boolean).join("\n")
  const scanTargets: Array<{ scene: SensitiveScene; text: string }> = []

  if (title) {
    scanTargets.push({ scene: "post.title", text: title })
  }

  if (content) {
    scanTargets.push({
      scene: input.targetType === "comment" ? "comment.content" : "post.content",
      text: content,
    })
  }

  const scans = await Promise.all(scanTargets.map((target) => scanSensitiveText(target)))
  const sensitiveHits = scans.flatMap((scan) => scan.hits.map((hit) => ({
    scene: scan.scene,
    word: hit.word,
    actionType: hit.actionType,
  })))
  const policyMatches = findLocalPolicyMatches(combined)

  let decision: CampusModerationDecision = "PASS"
  let riskLevel: CampusModerationRiskLevel = "LOW"
  const categories: string[] = []
  const reasons: string[] = []

  if (scans.some((scan) => scan.shouldReject)) {
    decision = "REJECT"
    riskLevel = "HIGH"
    categories.push("敏感词拦截")
    reasons.push("内容命中后台敏感词拦截规则。")
  } else if (scans.some((scan) => scan.wasReplaced || scan.hits.length > 0)) {
    decision = "REVIEW"
    riskLevel = "MEDIUM"
    categories.push("敏感词复核")
    reasons.push("内容命中后台敏感词替换或复核规则。")
  }

  for (const match of policyMatches) {
    decision = mergeDecision(decision, match.decision)
    riskLevel = mergeRisk(riskLevel, match.riskLevel)
    categories.push(match.category)
    reasons.push(match.reason)
  }

  return {
    decision,
    riskLevel,
    categories: uniqueStrings(categories),
    reason: reasons.length > 0 ? uniqueStrings(reasons).join(" ") : "未命中本地高风险规则。",
    suggestedAction: decision === "REJECT"
      ? "拒绝发布，并提示用户修改后再提交。"
      : decision === "REVIEW"
        ? "进入人工审核队列，由管理员复核后决定是否展示。"
        : "允许发布，保留常规人工巡检能力。",
    mode: "rules",
    aiConfigured: false,
    sensitiveHits,
  }
}

function buildAiPrompt(input: CampusModerationInput) {
  const title = normalizeText(input.title) || "(无标题)"
  const content = toPlainContent(input.content) || "(空内容)"
  return [
    "请审核以下校园墙用户生成内容，判断是否可在微信小程序内展示。",
    "",
    "审核依据：",
    "1. 中华人民共和国法律法规、社会主义核心价值观、公序良俗。",
    "2. 校园社区文明规范：不得辱骂、造谣、挂人、人肉、泄露隐私、组织冲突或骚扰。",
    "3. 微信小程序内容规范：不得涉黄、赌博、诈骗、毒品、暴恐、违法交易、违规引流、恶意营销、侵犯未成年人权益。",
    "4. 可讨论普通校园互助、失物招领、表白、树洞、二手闲置，但联系方式、群二维码、外链交易、曝光个人信息要谨慎复核。",
    "",
    `内容类型：${input.targetType}`,
    `标题：${title}`,
    `正文：${content}`,
    "",
    "只返回 JSON，不要输出 Markdown。字段：decision(PASS|REVIEW|REJECT), riskLevel(LOW|MEDIUM|HIGH), categories(string[]), reason(string), suggestedAction(string), confidence(0-1)。",
  ].join("\n")
}

async function runAiModeration(input: CampusModerationInput) {
  const config = await getServerAiReplyConfig()
  const aiConfigured = Boolean(config.baseUrl.trim() && config.model.trim() && config.apiKey?.trim())

  if (!aiConfigured) {
    return { aiConfigured, result: null, error: undefined as string | undefined }
  }

  try {
    const provider = new OpenAiCompatibleProvider({
      kind: "openai-compatible",
      baseUrl: config.baseUrl,
      apiKey: config.apiKey ?? "",
      defaultModel: config.model,
      defaultTimeoutMs: config.timeoutMs,
    })
    const response = await provider.chat([
      {
        role: "system",
        content: "你是严格、稳健的中文校园社区与微信小程序内容安全审核员。你必须优先保护用户安全、个人隐私、未成年人权益和平台合规。",
      },
      { role: "user", content: buildAiPrompt(input) },
    ], {
      model: config.model,
      temperature: 0,
      maxTokens: Math.min(Math.max(config.maxOutputTokens || 600, 256), 1200),
      timeoutMs: config.timeoutMs,
    })

    const parsed = parseJsonObject(response.text)
    if (!parsed) {
      return { aiConfigured, result: null, error: "AI 返回内容不是有效 JSON" }
    }

    const categoriesRaw = Array.isArray(parsed.categories) ? parsed.categories : []
    const categories = categoriesRaw
      .map((item) => typeof item === "string" ? item.trim() : "")
      .filter(Boolean)

    return {
      aiConfigured,
      result: {
        decision: normalizeDecision(parsed.decision),
        riskLevel: normalizeRisk(parsed.riskLevel),
        categories,
        reason: typeof parsed.reason === "string" && parsed.reason.trim() ? parsed.reason.trim() : "AI 未给出明确原因。",
        suggestedAction: typeof parsed.suggestedAction === "string" && parsed.suggestedAction.trim()
          ? parsed.suggestedAction.trim()
          : "请管理员结合内容场景复核。",
        confidence: normalizeConfidence(parsed.confidence),
      },
      error: undefined as string | undefined,
    }
  } catch (error) {
    console.warn("[campus-ai-moderation] AI moderation failed", error)
    return {
      aiConfigured,
      result: null,
      error: error instanceof Error ? error.message : "AI 审核调用失败",
    }
  }
}

export async function runCampusContentModeration(input: CampusModerationInput): Promise<CampusModerationResult> {
  const normalized: CampusModerationInput = {
    targetType: input.targetType,
    title: normalizeText(input.title),
    content: toPlainContent(input.content),
  }
  const rules = await runRuleModeration(normalized)
  const ai = await runAiModeration(normalized)

  if (!ai.result) {
    return {
      ...rules,
      aiConfigured: ai.aiConfigured,
      aiError: ai.error,
    }
  }

  const decision = mergeDecision(rules.decision, ai.result.decision)
  const riskLevel = mergeRisk(rules.riskLevel, ai.result.riskLevel)
  const categories = uniqueStrings([...rules.categories, ...ai.result.categories])
  const reason = uniqueStrings([
    ...(rules.decision !== "PASS" ? [rules.reason] : []),
    ai.result.reason,
  ]).join(" ") || "AI 审核未发现明显违规风险。"

  return {
    decision,
    riskLevel,
    categories,
    reason,
    suggestedAction: decision === ai.result.decision ? ai.result.suggestedAction : rules.suggestedAction,
    mode: rules.decision === "PASS" && rules.categories.length === 0 ? "ai" : "hybrid",
    aiConfigured: true,
    confidence: ai.result.confidence,
    sensitiveHits: rules.sensitiveHits,
  }
}

export async function readCampusModerationTarget(input: {
  targetType: CampusModerationTargetType
  targetId?: string
  title?: string
  content?: string
}) {
  if (input.targetType === "text") {
    return {
      targetType: "text" as const,
      title: normalizeText(input.title),
      content: normalizeText(input.content),
      currentStatus: null,
    }
  }

  if (!input.targetId?.trim()) {
    apiError(400, "缺少内容 ID")
  }

  if (input.targetType === "post") {
    const post = await prisma.post.findUnique({
      where: { id: input.targetId.trim() },
      select: {
        id: true,
        title: true,
        content: true,
        status: true,
      },
    })

    if (!post) {
      apiError(404, "帖子不存在")
    }

    return {
      targetType: "post" as const,
      title: post.title,
      content: toPlainContent(post.content),
      currentStatus: post.status,
    }
  }

  const comment = await prisma.comment.findUnique({
    where: { id: input.targetId.trim() },
    select: {
      id: true,
      content: true,
      status: true,
      post: {
        select: {
          title: true,
        },
      },
    },
  })

  if (!comment) {
    apiError(404, "评论不存在")
  }

  return {
    targetType: "comment" as const,
    title: comment.post.title,
    content: toPlainContent(comment.content),
    currentStatus: comment.status,
  }
}


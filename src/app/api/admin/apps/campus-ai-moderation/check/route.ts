import { CommentStatus, PostStatus } from "@/db/types"

import {
  apiError,
  apiSuccess,
  createAdminRouteHandler,
  readJsonBody,
  readOptionalStringField,
  type JsonObject,
} from "@/lib/api-route"
import {
  readCampusModerationTarget,
  runCampusContentModeration,
  type CampusModerationTargetType,
  type CampusModerationResult,
} from "@/lib/campus-ai-moderation"
import { updateCommentModerationState } from "@/db/admin-moderation-queries"
import { updatePostStatus } from "@/db/admin-post-action-queries"
import { revalidateUpdatedCommentMutation, revalidateUpdatedPostMutation } from "@/lib/content-mutation-revalidation"
import { ensureCanManageComment, ensureCanManagePost } from "@/lib/moderator-permissions"

type AdminModerationActor = Parameters<typeof ensureCanManagePost>[0]

function normalizeTargetType(value: string): CampusModerationTargetType {
  if (value === "comment" || value === "text") {
    return value
  }
  return "post"
}

function buildReviewNote(result: CampusModerationResult) {
  const categoryText = result.categories.length > 0 ? ` 分类：${result.categories.join("、")}` : ""
  return `AI 审核：${result.decision}/${result.riskLevel}。${result.reason}${categoryText}`
}

async function applyModerationDecision(input: {
  targetType: CampusModerationTargetType
  targetId: string
  result: CampusModerationResult
  adminUser: AdminModerationActor
  adminUserId: number
}) {
  const note = buildReviewNote(input.result)

  if (input.targetType === "post") {
    const post = await ensureCanManagePost(input.adminUser, input.targetId)
    if (input.result.decision === "REVIEW") {
      await updatePostStatus(input.targetId, PostStatus.PENDING, note)
    }
    if (input.result.decision === "REJECT") {
      await updatePostStatus(input.targetId, PostStatus.OFFLINE, note)
    }
    if (input.result.decision !== "PASS") {
      revalidateUpdatedPostMutation({
        postId: post.id,
        postSlug: post.slug,
        boardSlug: post.board.slug,
        zoneSlug: post.board.zone?.slug,
        authorId: post.authorId,
      })
    }
    return input.result.decision === "PASS" ? "AI 审核通过，未修改帖子状态" : "已按 AI 审核结果处理帖子"
  }

  if (input.targetType === "comment") {
    const comment = await ensureCanManageComment(input.adminUser, input.targetId)
    if (input.result.decision === "REVIEW") {
      await updateCommentModerationState(input.targetId, {
        status: CommentStatus.PENDING,
        reviewNote: note,
        reviewedById: input.adminUserId,
        reviewedAt: new Date(),
      })
    }
    if (input.result.decision === "REJECT") {
      await updateCommentModerationState(input.targetId, {
        status: CommentStatus.HIDDEN,
        reviewNote: note,
        reviewedById: input.adminUserId,
        reviewedAt: new Date(),
      })
    }
    if (input.result.decision !== "PASS") {
      revalidateUpdatedCommentMutation({
        postId: comment.postId,
        postSlug: comment.post.slug,
        boardSlug: comment.post.board.slug,
        authorId: comment.userId,
      })
    }
    return input.result.decision === "PASS" ? "AI 审核通过，未修改评论状态" : "已按 AI 审核结果处理评论"
  }

  return "文本检测完成"
}

export const POST = createAdminRouteHandler(async ({ request, adminUser }) => {
  const body = await readJsonBody(request) as JsonObject
  const targetType = normalizeTargetType(readOptionalStringField(body, "targetType"))
  const targetId = readOptionalStringField(body, "targetId")
  const apply = body.apply === true

  if (targetType === "post" && targetId) {
    await ensureCanManagePost(adminUser, targetId)
  }
  if (targetType === "comment" && targetId) {
    await ensureCanManageComment(adminUser, targetId)
  }

  const target = await readCampusModerationTarget({
    targetType,
    targetId,
    title: readOptionalStringField(body, "title"),
    content: readOptionalStringField(body, "content"),
  })

  if (!target.content && !target.title) {
    apiError(400, "请填写需要审核的内容")
  }

  const result = await runCampusContentModeration({
    targetType,
    title: target.title,
    content: target.content,
  })

  const applyMessage = apply
    ? await applyModerationDecision({
      targetType,
      targetId,
      result,
      adminUser,
      adminUserId: adminUser.id,
    })
    : null

  return apiSuccess({
    target: {
      targetType,
      targetId: targetId || null,
      currentStatus: target.currentStatus,
      title: target.title,
      content: target.content,
    },
    result,
    applied: Boolean(apply),
    applyMessage,
  }, applyMessage ?? "AI 审核检测完成")
}, {
  errorMessage: "AI 审核检测失败",
  logPrefix: "[api/admin/apps/campus-ai-moderation/check:POST] unexpected error",
  unauthorizedMessage: "无权执行 AI 审核",
  allowModerator: true,
})

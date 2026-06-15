import {
  apiError,
  apiSuccess,
  createUserRouteHandler,
  readJsonBody,
  readOptionalStringField,
} from "@/lib/api-route"
import { runCampusContentModeration } from "@/lib/campus-ai-moderation"
import { executeCommentCreation } from "@/lib/comment-create-execution"

export const POST = createUserRouteHandler(async ({ request, currentUser }) => {
  const body = await readJsonBody(request)
  const content = readOptionalStringField(body, "content")

  const moderation = await runCampusContentModeration({
    targetType: "comment",
    content,
  })

  if (moderation.decision === "REJECT") {
    apiError(400, moderation.reason || "评论不符合平台规范，请修改后再提交")
  }

  const reviewRequiredByAi = moderation.decision === "REVIEW"
  const result = await executeCommentCreation(body, {
    request,
    author: {
      id: currentUser.id,
      username: currentUser.username,
      nickname: currentUser.nickname,
      status: currentUser.status,
    },
    statusMode: reviewRequiredByAi ? "PENDING" : "AUTO",
    reviewNote: reviewRequiredByAi ? `AI 审核建议人工复核：${moderation.reason}` : undefined,
    log: {
      scope: "wall-comments-create",
      action: "create-wall-comment",
      extra: {
        campusAiModeration: {
          decision: moderation.decision,
          riskLevel: moderation.riskLevel,
          categories: moderation.categories,
          mode: moderation.mode,
        },
      },
    },
  })

  return apiSuccess({
    id: result.created.id,
    reviewRequired: result.reviewRequired,
    moderation,
    navigation: {
      page: result.targetPage,
      sort: "oldest",
      view: result.commentView,
      anchor: `comment-${result.created.id}`,
    },
  }, result.reviewRequired ? "已提交，等待人工审核" : "评论成功")
}, {
  errorMessage: "发布校园墙评论失败",
  logPrefix: "[api/wall/comments:POST] unexpected error",
  unauthorizedMessage: "请先登录后再评论",
  allowStatuses: ["ACTIVE"],
})


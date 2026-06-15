import {
  apiError,
  apiSuccess,
  createRouteHandler,
  createUserRouteHandler,
  readJsonBody,
  readOptionalStringField,
} from "@/lib/api-route"
import { getWallPosts, normalizeWallPage } from "@/lib/campus-wall"
import { runCampusContentModeration } from "@/lib/campus-ai-moderation"
import { executePostCreation } from "@/lib/post-create-execution"

export const GET = createRouteHandler(async ({ request }) => {
  const url = new URL(request.url)
  const { page, pageSize } = normalizeWallPage(url.searchParams)
  const boardSlug = url.searchParams.get("board")?.trim() || undefined
  const sort = url.searchParams.get("sort")?.trim() || undefined

  return apiSuccess(await getWallPosts({
    page,
    pageSize,
    boardSlug,
    sort,
  }), "success")
}, {
  errorMessage: "获取校园墙动态失败",
  logPrefix: "[api/wall/posts:GET] unexpected error",
})

export const POST = createUserRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const title = readOptionalStringField(body, "title")
  const content = readOptionalStringField(body, "content")

  const moderation = await runCampusContentModeration({
    targetType: "post",
    title,
    content,
  })

  if (moderation.decision === "REJECT") {
    apiError(400, moderation.reason || "内容不符合平台规范，请修改后再提交")
  }

  const shouldPending = moderation.decision === "REVIEW"
  const result = await executePostCreation({
    ...body,
    title,
    content,
    postType: "NORMAL",
  }, {
    request,
    statusMode: shouldPending ? "PENDING" : "AUTO",
    log: {
      scope: "wall-posts-create",
      action: "create-wall-post",
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
    id: result.post.id,
    slug: result.post.slug,
    status: result.post.status,
    reviewRequired: result.shouldPending,
    moderation,
  }, result.shouldPending ? "已提交，等待人工审核" : "发布成功")
}, {
  errorMessage: "发布校园墙动态失败",
  logPrefix: "[api/wall/posts:POST] unexpected error",
  unauthorizedMessage: "请先登录后再发布",
  allowStatuses: ["ACTIVE"],
})


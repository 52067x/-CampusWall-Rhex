import {
  apiError,
  apiSuccess,
  createUserRouteHandler,
  readJsonBody,
  readOptionalStringField,
} from "@/lib/api-route"
import { runCampusContentModeration, type CampusModerationTargetType } from "@/lib/campus-ai-moderation"

function normalizeTargetType(value: string): CampusModerationTargetType {
  if (value === "comment" || value === "text") {
    return value
  }
  return "post"
}

export const POST = createUserRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const content = readOptionalStringField(body, "content")
  const title = readOptionalStringField(body, "title")
  const targetType = normalizeTargetType(readOptionalStringField(body, "targetType"))

  if (!content && !title) {
    apiError(400, "请填写需要审核的内容")
  }

  const result = await runCampusContentModeration({
    targetType,
    title,
    content,
  })

  return apiSuccess(result, "success")
}, {
  errorMessage: "AI 审核检测失败",
  logPrefix: "[api/wall/moderation/check:POST] unexpected error",
  unauthorizedMessage: "请先登录后再检测内容",
  allowStatuses: ["ACTIVE"],
})


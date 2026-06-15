import { apiError, apiSuccess, createRouteHandler } from "@/lib/api-route"
import { getWallPostDetail } from "@/lib/campus-wall"

interface WallPostDetailRouteContext {
  params: Promise<{
    postId: string
  }>
}

export const GET = createRouteHandler(async ({ routeContext }) => {
  const params = await (routeContext as WallPostDetailRouteContext | undefined)?.params
  const postId = decodeURIComponent(params?.postId ?? "").trim()

  if (!postId) {
    apiError(400, "缺少动态 ID")
  }

  return apiSuccess(await getWallPostDetail(postId), "success")
}, {
  errorMessage: "获取校园墙动态详情失败",
  logPrefix: "[api/wall/posts/[postId]:GET] unexpected error",
})


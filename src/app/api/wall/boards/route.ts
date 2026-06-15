import { apiSuccess, createRouteHandler } from "@/lib/api-route"
import { getWallBoards } from "@/lib/campus-wall"

export const GET = createRouteHandler(async () => {
  return apiSuccess({
    boards: await getWallBoards(),
  }, "success")
}, {
  errorMessage: "获取校园墙频道失败",
  logPrefix: "[api/wall/boards:GET] unexpected error",
})


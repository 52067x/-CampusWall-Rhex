import { NextResponse } from "next/server"

import { apiError, apiSuccess, createRouteHandler, readJsonBody, readOptionalStringField } from "@/lib/api-route"
import { createRegisterFlow } from "@/lib/auth-register-service"
import { getRequestIp } from "@/lib/request-ip"
import { createSessionToken, getSessionCookieName, getSessionCookieOptions } from "@/lib/session"

function normalizePhone(value: string) {
  return value.replace(/\s+/g, "")
}

export const POST = createRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const phone = normalizePhone(readOptionalStringField(body, "phone"))
  const password = readOptionalStringField(body, "password")
  const inviteCode = readOptionalStringField(body, "inviteCode").toUpperCase()
  const nicknameInput = readOptionalStringField(body, "nickname")

  if (!/^1\d{10}$/.test(phone)) {
    apiError(400, "请填写正确的手机号")
  }

  if (!inviteCode) {
    apiError(400, "请填写邀请码")
  }

  const registerBody = {
    username: `u${phone}`,
    password,
    phone,
    inviteCode,
    nickname: nicknameInput || `同学${phone.slice(-4)}`,
    gender: "unknown",
  }

  const result = await createRegisterFlow({
    request,
    body: registerBody,
  })

  const response = NextResponse.json(apiSuccess({
    user: {
      id: result.user.id,
      username: result.user.username,
    },
    autoLogin: true,
  }, result.successMessage ?? "注册成功"))

  const sessionToken = await createSessionToken(result.user.username, getRequestIp(request))
  response.cookies.set(getSessionCookieName(), sessionToken, getSessionCookieOptions({ request }))

  return response
}, {
  errorMessage: "校园墙手机号注册失败",
  logPrefix: "[api/wall/auth/register:POST] unexpected error",
})


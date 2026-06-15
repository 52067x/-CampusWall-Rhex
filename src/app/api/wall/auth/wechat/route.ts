import { createHash, randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { hashSync } from "bcryptjs"

import { prisma } from "@/db/client"
import {
  createUserLoginLogEntry,
  findAuthenticatedUserSummaryById,
  findInviteCodeRegistrationContext,
  incrementUserInviteCount,
  markInviteCodeAsUsed,
  recordSuccessfulExternalLoginByUserId,
} from "@/db/external-auth-user-queries"
import { apiError, apiSuccess, createRouteHandler, readJsonBody, readOptionalStringField } from "@/lib/api-route"
import { createExternalAuthAccount, findExternalAuthAccount } from "@/lib/external-auth-store"
import { getRequestIp } from "@/lib/request-ip"
import { createSessionToken, getSessionCookieName, getSessionCookieOptions } from "@/lib/session"
import { getServerSiteSettings } from "@/lib/site-settings"
import { resolveEffectiveUserStatus } from "@/lib/user-status"

interface WechatSessionResponse {
  openid?: string
  unionid?: string
  session_key?: string
  errcode?: number
  errmsg?: string
}

const PROVIDER = "wechat-miniapp"

function hashOpenId(value: string) {
  return createHash("sha1").update(value).digest("hex")
}

function buildUsername(openid: string, attempt = 0) {
  const hash = hashOpenId(openid)
  return attempt === 0
    ? `wx_${hash.slice(0, 16)}`
    : `wx_${hash.slice(0, 13)}${attempt}`
}

function buildNickname(openid: string, nicknameInput: string, attempt = 0) {
  const base = nicknameInput || `微信同学${hashOpenId(openid).slice(0, 6)}`
  return attempt === 0 ? base.slice(0, 20) : `${base.slice(0, 16)}${attempt}`.slice(0, 20)
}

async function requestWechatSession(code: string) {
  const appid = process.env.WECHAT_MINIAPP_APPID?.trim()
  const secret = process.env.WECHAT_MINIAPP_SECRET?.trim()

  if (!appid || !secret) {
    apiError(500, "未配置 WECHAT_MINIAPP_APPID 或 WECHAT_MINIAPP_SECRET")
  }

  const url = new URL("https://api.weixin.qq.com/sns/jscode2session")
  url.searchParams.set("appid", appid)
  url.searchParams.set("secret", secret)
  url.searchParams.set("js_code", code)
  url.searchParams.set("grant_type", "authorization_code")

  const response = await fetch(url, { cache: "no-store" })
  const payload = await response.json().catch(() => null) as WechatSessionResponse | null

  if (!response.ok || !payload) {
    apiError(502, "微信登录服务暂不可用")
  }

  if (payload.errcode) {
    apiError(400, payload.errmsg || "微信登录凭证无效")
  }

  if (!payload.openid) {
    apiError(400, "微信登录未返回 openid")
  }

  return payload
}

async function assertExistingUserCanLogin(userId: number) {
  const user = await findAuthenticatedUserSummaryById(userId)
  if (!user) {
    apiError(404, "关联的站内账号不存在")
  }

  const effectiveStatus = resolveEffectiveUserStatus(user)
  if (effectiveStatus === "BANNED") {
    apiError(403, "账号已被封禁，无法登录")
  }
  if (effectiveStatus === "INACTIVE") {
    apiError(403, "账号尚未激活，无法登录")
  }

  return user
}

async function createWechatUser(input: {
  request: Request
  openid: string
  unionid?: string | null
  inviteCode: string
  nickname: string
  avatarUrl: string
}) {
  const settings = await getServerSiteSettings()
  if (!settings.registrationEnabled) {
    apiError(403, "当前站点已关闭注册")
  }

  if (!input.inviteCode) {
    apiError(400, "请填写邀请码")
  }

  const loginIp = getRequestIp(input.request)
  const userAgent = input.request.headers.get("user-agent")
  const accountId = input.unionid || input.openid

  return prisma.$transaction(async (tx) => {
    const foundCode = await findInviteCodeRegistrationContext(input.inviteCode, tx)
    if (!foundCode) {
      apiError(404, "邀请码不存在")
    }
    if (foundCode.usedById) {
      apiError(409, "邀请码已被使用")
    }

    let createdUser: { id: number; username: string } | null = null

    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        createdUser = await tx.user.create({
          data: {
            username: buildUsername(accountId, attempt),
            passwordHash: hashSync(randomUUID(), 10),
            nickname: buildNickname(input.openid, input.nickname, attempt),
            avatarPath: input.avatarUrl || null,
            inviterId: foundCode.createdBy?.id ?? null,
            lastLoginAt: new Date(),
            lastLoginIp: loginIp,
          },
          select: {
            id: true,
            username: true,
          },
        })
        break
      } catch (error) {
        if (attempt === 7) {
          throw error
        }
      }
    }

    if (!createdUser) {
      apiError(500, "创建微信账号失败")
    }

    await createExternalAuthAccount({
      client: tx,
      userId: createdUser.id,
      provider: PROVIDER,
      providerAccountId: accountId,
      providerUsername: input.nickname || null,
      providerEmail: null,
      metadataJson: JSON.stringify({
        openid: input.openid,
        unionid: input.unionid ?? null,
        avatarUrl: input.avatarUrl || null,
      }),
    })

    await markInviteCodeAsUsed(foundCode.id, createdUser.id, tx)
    if (foundCode.createdBy) {
      await incrementUserInviteCount(foundCode.createdBy.id, tx)
    }
    await createUserLoginLogEntry(createdUser.id, loginIp, userAgent, tx)

    return createdUser
  })
}

export const POST = createRouteHandler(async ({ request }) => {
  const body = await readJsonBody(request)
  const code = readOptionalStringField(body, "code")
  const inviteCode = readOptionalStringField(body, "inviteCode").toUpperCase()
  const nickname = readOptionalStringField(body, "nickname")
  const avatarUrl = readOptionalStringField(body, "avatarUrl")

  if (!code) {
    apiError(400, "缺少微信登录 code")
  }

  const session = await requestWechatSession(code)
  const providerAccountId = session.unionid || session.openid || ""
  const existingAccount = providerAccountId
    ? await findExternalAuthAccount(PROVIDER, providerAccountId)
    : null

  const user = existingAccount
    ? await assertExistingUserCanLogin(existingAccount.userId)
    : await createWechatUser({
      request,
      openid: session.openid || "",
      unionid: session.unionid ?? null,
      inviteCode,
      nickname,
      avatarUrl,
    })

  if (existingAccount) {
    await recordSuccessfulExternalLoginByUserId(user.id, getRequestIp(request), request.headers.get("user-agent"))
  }

  const response = NextResponse.json(apiSuccess({
    user: {
      id: user.id,
      username: user.username,
    },
    created: !existingAccount,
  }, "登录成功"))
  const sessionToken = await createSessionToken(user.username, getRequestIp(request))
  response.cookies.set(getSessionCookieName(), sessionToken, getSessionCookieOptions({ request }))

  return response
}, {
  errorMessage: "微信登录失败",
  logPrefix: "[api/wall/auth/wechat:POST] unexpected error",
})


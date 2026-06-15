import {
  AnnouncementStatus,
  BadgeRuleOperator,
  BadgeRuleType,
  BoardStatus,
  PrismaClient,
  UserRole,
  UserStatus,
} from "@prisma/client"
import { hashSync } from "bcryptjs"

import { getBuiltinCustomPageSeeds } from "../src/lib/builtin-custom-pages"

const prisma = new PrismaClient()

const APP_VERSION = "campus-wall-1.0.0"
const DEFAULT_ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME?.trim() || "admin"
const DEFAULT_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD?.trim() || "ChangeMe_123456"
const DEFAULT_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL?.trim() || "admin@campus-wall.local"
const DEFAULT_ADMIN_NICKNAME = process.env.SEED_ADMIN_NICKNAME?.trim() || "校园墙管理员"

const CAMPUS_ZONE_SLUG = "campus-wall"
const ANONYMOUS_MASK_USERNAME = "anonymous-campus-wall"

const defaultLevelDefinitions = [
  { level: 1, name: "新同学", color: "#64748b", icon: "1", requireCheckInDays: 0, requirePostCount: 0, requireCommentCount: 0, requireLikeCount: 0 },
  { level: 2, name: "常来看看", color: "#0f766e", icon: "2", requireCheckInDays: 1, requirePostCount: 1, requireCommentCount: 1, requireLikeCount: 0 },
  { level: 3, name: "墙上熟人", color: "#2563eb", icon: "3", requireCheckInDays: 7, requirePostCount: 3, requireCommentCount: 8, requireLikeCount: 5 },
  { level: 4, name: "校园帮手", color: "#16a34a", icon: "4", requireCheckInDays: 15, requirePostCount: 8, requireCommentCount: 20, requireLikeCount: 15 },
  { level: 5, name: "活跃同学", color: "#f05d3b", icon: "5", requireCheckInDays: 30, requirePostCount: 15, requireCommentCount: 40, requireLikeCount: 35 },
  { level: 6, name: "墙边达人", color: "#9333ea", icon: "6", requireCheckInDays: 90, requirePostCount: 30, requireCommentCount: 80, requireLikeCount: 80 },
  { level: 7, name: "校园向导", color: "#0891b2", icon: "7", requireCheckInDays: 180, requirePostCount: 60, requireCommentCount: 140, requireLikeCount: 160 },
  { level: 8, name: "年度同学", color: "#ca8a04", icon: "8", requireCheckInDays: 365, requirePostCount: 100, requireCommentCount: 240, requireLikeCount: 320 },
  { level: 9, name: "镇墙老友", color: "#dc2626", icon: "9", requireCheckInDays: 720, requirePostCount: 180, requireCommentCount: 420, requireLikeCount: 640 },
] as const

const defaultBadges = [
  {
    name: "第一次上墙",
    code: "first-post",
    description: "完成第一次校园墙发帖。",
    iconText: "帖",
    color: "#0f766e",
    category: "校园墙成长",
    sortOrder: 10,
    status: true,
    isHidden: false,
    rules: [{ ruleType: BadgeRuleType.POST_COUNT, operator: BadgeRuleOperator.GTE, value: "1", sortOrder: 0 }],
  },
  {
    name: "第一次回应",
    code: "first-comment",
    description: "完成第一次评论互动。",
    iconText: "评",
    color: "#2563eb",
    category: "校园墙成长",
    sortOrder: 20,
    status: true,
    isHidden: false,
    rules: [{ ruleType: BadgeRuleType.COMMENT_COUNT, operator: BadgeRuleOperator.GTE, value: "1", sortOrder: 0 }],
  },
  {
    name: "被看见的同学",
    code: "liked-10",
    description: "累计获得 10 个赞。",
    iconText: "赞",
    color: "#f05d3b",
    category: "互动认可",
    sortOrder: 30,
    status: true,
    isHidden: false,
    rules: [{ ruleType: BadgeRuleType.RECEIVED_LIKE_COUNT, operator: BadgeRuleOperator.GTE, value: "10", sortOrder: 0 }],
  },
  {
    name: "热心答复",
    code: "comment-50",
    description: "累计评论达到 50 次。",
    iconText: "帮",
    color: "#16a34a",
    category: "互动认可",
    sortOrder: 40,
    status: true,
    isHidden: false,
    rules: [{ ruleType: BadgeRuleType.COMMENT_COUNT, operator: BadgeRuleOperator.GTE, value: "50", sortOrder: 0 }],
  },
  {
    name: "持续创作",
    code: "post-10",
    description: "累计发布 10 篇主题。",
    iconText: "写",
    color: "#9333ea",
    category: "内容贡献",
    sortOrder: 50,
    status: true,
    isHidden: false,
    rules: [{ ruleType: BadgeRuleType.POST_COUNT, operator: BadgeRuleOperator.GTE, value: "10", sortOrder: 0 }],
  },
  {
    name: "邀请同学",
    code: "invite-10",
    description: "成功邀请 10 位同学加入。",
    iconText: "邀",
    color: "#ca8a04",
    category: "社区贡献",
    sortOrder: 60,
    status: true,
    isHidden: false,
    rules: [{ ruleType: BadgeRuleType.INVITE_COUNT, operator: BadgeRuleOperator.GTE, value: "10", sortOrder: 0 }],
  },
] as const

function parseJsonRecord(value: string | null | undefined): Record<string, unknown> {
  if (!value) {
    return {}
  }

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function buildCampusAppState(existingJson: string | null | undefined, maskUserId: number) {
  const appState = parseJsonRecord(existingJson)
  const siteSettings = asRecord(appState.__siteSettings)

  return JSON.stringify({
    ...appState,
    __siteSettings: {
      ...siteSettings,
      authPageShowcase: { enabled: true },
      leftSidebarDisplay: { mode: "DEFAULT" },
      anonymousPost: {
        enabled: true,
        price: 0,
        dailyLimit: 5,
        maskUserId,
        allowReplySwitch: true,
        defaultReplyAnonymous: true,
      },
      registerEmailWhitelist: {
        enabled: false,
        domains: [],
      },
      registerInviteCodeHelp: {
        enabled: true,
        title: "如何获得邀请码？",
        url: "/faq",
      },
      emailBusinessSwitches: {
        registerVerification: true,
        resetPasswordVerification: true,
        passwordChangeVerification: true,
        loginIpChangeAlert: true,
        paymentOrderSuccess: true,
        lotteryWinner: true,
        systemNotification: true,
        privateMessage: true,
        addon: true,
      },
    },
  })
}

async function ensureAdminUser() {
  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { username: DEFAULT_ADMIN_USERNAME },
        { role: UserRole.ADMIN },
      ],
    },
    orderBy: { createdAt: "asc" },
  })

  if (existingAdmin) {
    return existingAdmin
  }

  return prisma.user.create({
    data: {
      username: DEFAULT_ADMIN_USERNAME,
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash: hashSync(DEFAULT_ADMIN_PASSWORD, 10),
      nickname: DEFAULT_ADMIN_NICKNAME,
      bio: `校园墙 ${APP_VERSION} 初始化管理员账号。首次登录后请修改密码和站点资料。`,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      points: 0,
      level: 1,
    },
  })
}

async function ensureAnonymousMaskUser() {
  return prisma.user.upsert({
    where: { username: ANONYMOUS_MASK_USERNAME },
    update: {
      nickname: "匿名同学",
      bio: "校园墙匿名发布统一展示账号，真实发布者仅供后台风控追溯。",
      status: UserStatus.ACTIVE,
    },
    create: {
      username: ANONYMOUS_MASK_USERNAME,
      passwordHash: hashSync(`disabled-${Date.now()}-${Math.random()}`, 10),
      nickname: "匿名同学",
      bio: "校园墙匿名发布统一展示账号，真实发布者仅供后台风控追溯。",
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      points: 0,
      level: 1,
    },
  })
}

async function ensureSiteSettings(maskUserId: number) {
  const existing = await prisma.siteSetting.findFirst({ orderBy: { createdAt: "asc" } })
  const appStateJson = buildCampusAppState(existing?.appStateJson, maskUserId)
  const footerLinksJson = JSON.stringify([
    { label: "关于", href: "/about" },
    { label: "使用帮助", href: "/help" },
    { label: "邀请码 FAQ", href: "/faq" },
    { label: "小黑屋", href: "/prison" },
    { label: "协议", href: "/terms" },
  ])
  const headerAppLinksJson = JSON.stringify([
    { id: "home", name: "校园墙", href: "/" },
    { id: "boards", name: "频道", href: "/boards" },
    { id: "write", name: "发帖", href: "/write" },
    { id: "messages", name: "私信", href: "/messages" },
  ])
  const siteSettingsData = {
    siteName: "校园墙",
    siteSlogan: "校内真实互助、轻量表达和有序讨论",
    siteDescription: "校园墙是面向校内同学的匿名与实名社区，支持表白、树洞、失物招领、二手闲置、校园互助和活动组队，并通过 AI 审核与人工复核共同保障内容安全。",
    siteLogoText: "校园墙",
    siteSeoKeywords: "校园墙,表白墙,树洞,失物招领,校园论坛,微信小程序",
    pointName: "积分",
    footerLinksJson,
    headerAppLinksJson,
    headerAppIconName: "message-square",
    analyticsCode: null,
    friendLinksEnabled: false,
    friendLinkApplicationEnabled: false,
    friendLinkAnnouncement: "校园墙暂不开放外部友情链接申请。",
    checkInEnabled: true,
    checkInReward: 5,
    inviteRewardInviter: 0,
    inviteRewardInvitee: 0,
    registrationEnabled: true,
    registrationRequireInviteCode: true,
    registerInviteCodeEnabled: true,
    inviteCodePurchaseEnabled: false,
    inviteCodePrice: 0,
    registerCaptchaMode: "OFF",
    loginCaptchaMode: "OFF",
    nicknameChangePointCost: 0,
    tippingEnabled: false,
    postRedPacketEnabled: false,
    registerEmailEnabled: false,
    registerEmailRequired: false,
    registerEmailVerification: false,
    registerPhoneEnabled: true,
    registerPhoneRequired: true,
    registerPhoneVerification: false,
    registerNicknameEnabled: true,
    registerNicknameRequired: false,
    registerGenderEnabled: false,
    registerGenderRequired: false,
    registerInviterEnabled: false,
    smtpEnabled: false,
    vipMonthlyPrice: 30,
    vipQuarterlyPrice: 88,
    vipYearlyPrice: 288,
    uploadProvider: "local",
    uploadLocalPath: "uploads",
    uploadRequireLogin: true,
    uploadAllowedImageTypes: "jpg,jpeg,png,gif,webp",
    uploadMaxFileSizeMb: 5,
    uploadAvatarMaxFileSizeMb: 2,
    appStateJson,
  }

  if (existing) {
    return prisma.siteSetting.update({
      where: { id: existing.id },
      data: siteSettingsData,
    })
  }

  return prisma.siteSetting.create({ data: siteSettingsData })
}

async function ensureLevelDefinitions() {
  for (const item of defaultLevelDefinitions) {
    await prisma.levelDefinition.upsert({
      where: { level: item.level },
      update: { ...item },
      create: { ...item },
    })
  }
}

async function ensureDefaultBadges() {
  for (const badge of defaultBadges) {
    const savedBadge = await prisma.badge.upsert({
      where: { code: badge.code },
      update: {
        name: badge.name,
        description: badge.description,
        iconText: badge.iconText,
        color: badge.color,
        category: badge.category,
        sortOrder: badge.sortOrder,
        status: badge.status,
        isHidden: badge.isHidden,
      },
      create: {
        name: badge.name,
        code: badge.code,
        description: badge.description,
        iconText: badge.iconText,
        color: badge.color,
        category: badge.category,
        sortOrder: badge.sortOrder,
        status: badge.status,
        isHidden: badge.isHidden,
      },
      select: { id: true },
    })

    await prisma.badgeRule.deleteMany({ where: { badgeId: savedBadge.id } })
    await prisma.badgeRule.createMany({
      data: badge.rules.map((rule) => ({
        badgeId: savedBadge.id,
        ruleType: rule.ruleType,
        operator: rule.operator,
        value: rule.value,
        sortOrder: rule.sortOrder,
      })),
    })
  }
}

async function ensureBaseTaxonomy() {
  const zone = await prisma.zone.upsert({
    where: { slug: CAMPUS_ZONE_SLUG },
    update: {
      name: "校园墙",
      description: "校园墙小程序专用分区，仅开放符合微信小程序规范和校园社区规范的普通主题。",
      icon: "wall",
      sortOrder: 1,
      showInHomeFeed: true,
      allowUserPost: true,
      allowUserReply: true,
      requirePostReview: false,
      requireCommentReview: false,
      allowedPostTypes: "NORMAL",
    },
    create: {
      name: "校园墙",
      slug: CAMPUS_ZONE_SLUG,
      description: "校园墙小程序专用分区，仅开放符合微信小程序规范和校园社区规范的普通主题。",
      icon: "wall",
      sortOrder: 1,
      showInHomeFeed: true,
      allowUserPost: true,
      allowUserReply: true,
      requirePostReview: false,
      requireCommentReview: false,
      allowedPostTypes: "NORMAL",
    },
  })

  const boardSpecs = [
    { name: "表白墙", slug: "confession", description: "温和表达好感、感谢和祝福；涉及个人隐私或攻击性内容会进入复核。", sortOrder: 1, requirePostReview: true, requireCommentReview: true, allowPost: true, allowUserPost: true },
    { name: "树洞倾诉", slug: "tree-hole", description: "匿名倾诉与情绪支持；不展示人肉、曝光、威胁或伤害信息。", sortOrder: 2, requirePostReview: true, requireCommentReview: true, allowPost: true, allowUserPost: true },
    { name: "失物招领", slug: "lost-found", description: "发布失物、拾物和线索，建议避免直接公开完整手机号、宿舍号等隐私。", sortOrder: 3, requirePostReview: false, requireCommentReview: false, allowPost: true, allowUserPost: true },
    { name: "二手闲置", slug: "flea-market", description: "校内闲置转让与求购，只允许合规物品，不支持抽奖、博彩、贷款和诱导交易。", sortOrder: 4, requirePostReview: true, requireCommentReview: false, allowPost: true, allowUserPost: true },
    { name: "校园互助", slug: "campus-help", description: "课程、生活、办事流程、校园经验互助。", sortOrder: 5, requirePostReview: false, requireCommentReview: false, allowPost: true, allowUserPost: true },
    { name: "活动组队", slug: "activity-team", description: "学习、运动、社团和活动组队；群二维码、外链引流等内容需复核。", sortOrder: 6, requirePostReview: true, requireCommentReview: false, allowPost: true, allowUserPost: true },
    { name: "官方公告", slug: "official-announcements", description: "管理员发布校园墙公告、规则和运营说明。", sortOrder: 7, requirePostReview: false, requireCommentReview: false, allowPost: false, allowUserPost: false },
  ] as const

  for (const item of boardSpecs) {
    await prisma.board.upsert({
      where: { slug: item.slug },
      update: {
        zoneId: zone.id,
        name: item.name,
        description: item.description,
        status: BoardStatus.ACTIVE,
        sortOrder: item.sortOrder,
        allowPost: item.allowPost,
        allowUserPost: item.allowUserPost,
        allowUserReply: true,
        requirePostReview: item.requirePostReview,
        requireCommentReview: item.requireCommentReview,
        allowedPostTypes: "NORMAL",
        showInHomeFeed: true,
      },
      create: {
        zoneId: zone.id,
        name: item.name,
        slug: item.slug,
        description: item.description,
        status: BoardStatus.ACTIVE,
        sortOrder: item.sortOrder,
        allowPost: item.allowPost,
        allowUserPost: item.allowUserPost,
        allowUserReply: true,
        requirePostReview: item.requirePostReview,
        requireCommentReview: item.requireCommentReview,
        allowedPostTypes: "NORMAL",
        showInHomeFeed: true,
      },
    })
  }

  return zone
}

async function ensureInviteCodes(adminId: number) {
  const codes = [
    { code: "CAMPUS2026", note: "校园墙默认测试邀请码" },
    { code: "WALL2026", note: "校园墙默认测试邀请码" },
    { code: "TEST2026", note: "校园墙默认测试邀请码" },
  ]

  for (const item of codes) {
    await prisma.inviteCode.upsert({
      where: { code: item.code },
      update: {
        note: item.note,
        createdById: adminId,
        expiresAt: null,
      },
      create: {
        code: item.code,
        note: item.note,
        createdById: adminId,
        expiresAt: null,
      },
    })
  }
}

async function ensureBuiltinCustomPages(
  adminId: number,
  settings: {
    siteName: string
    siteDescription: string
    pointName: string
  },
) {
  for (const seed of getBuiltinCustomPageSeeds(settings)) {
    await prisma.customPage.upsert({
      where: { routePath: seed.routePath },
      update: {
        title: seed.title,
        htmlContent: seed.htmlContent,
        status: AnnouncementStatus.PUBLISHED,
        includeHeader: seed.includeHeader,
        includeFooter: seed.includeFooter,
        includeLeftSidebar: seed.includeLeftSidebar,
        includeRightSidebar: seed.includeRightSidebar,
        publishedAt: new Date(),
      },
      create: {
        title: seed.title,
        routePath: seed.routePath,
        htmlContent: seed.htmlContent,
        status: AnnouncementStatus.PUBLISHED,
        includeHeader: seed.includeHeader,
        includeFooter: seed.includeFooter,
        includeLeftSidebar: seed.includeLeftSidebar,
        includeRightSidebar: seed.includeRightSidebar,
        publishedAt: new Date(),
        createdBy: adminId,
      },
    })
  }
}

function campusDocHtml(title: string, paragraphs: string[]) {
  return `
<section style="display:flex;flex-direction:column;gap:16px;">
  <article style="border:1px solid hsl(var(--border));background:hsl(var(--card));border-radius:12px;padding:24px;">
    <h1 style="margin:0;color:hsl(var(--foreground));font-size:30px;line-height:1.3;font-weight:800;">${title}</h1>
    ${paragraphs.map((paragraph) => `<p style="margin:14px 0 0;color:hsl(var(--muted-foreground));font-size:14px;line-height:1.9;">${paragraph}</p>`).join("\n")}
  </article>
</section>`.trim()
}

async function ensureCampusDocs(adminId: number) {
  const pages = [
    {
      title: "校园墙使用帮助",
      routePath: "/help",
      htmlContent: campusDocHtml("校园墙使用帮助", [
        "校园墙支持表白墙、树洞倾诉、失物招领、二手闲置、校园互助和活动组队等轻量场景。",
        "所有新用户必须使用邀请码注册。匿名发布只隐藏前台展示身份，后台仍保留必要的风控追溯能力。",
        "发帖和评论会先经过 AI 审核与本地规则检测；高风险内容会被拒绝，疑似风险内容会进入人工审核队列。",
      ]),
    },
    {
      title: "邀请码与审核 FAQ",
      routePath: "/faq",
      htmlContent: campusDocHtml("邀请码与审核 FAQ", [
        "默认测试邀请码为 CAMPUS2026、WALL2026、TEST2026。正式运营时请在后台生成和分发新的邀请码。",
        "手机号注册需要手机号、邀请码和密码；微信登录首次绑定也需要邀请码。已绑定微信的用户可直接再次登录。",
        "微信小程序端只开放普通主题发布；抽奖、竞拍、红包、博彩、外部引流等不适合小程序规范的能力不会在小程序端展示。",
      ]),
    },
  ]

  for (const page of pages) {
    await prisma.customPage.upsert({
      where: { routePath: page.routePath },
      update: {
        title: page.title,
        htmlContent: page.htmlContent,
        status: AnnouncementStatus.PUBLISHED,
        includeHeader: true,
        includeFooter: true,
        includeLeftSidebar: true,
        includeRightSidebar: true,
        publishedAt: new Date(),
      },
      create: {
        title: page.title,
        routePath: page.routePath,
        htmlContent: page.htmlContent,
        status: AnnouncementStatus.PUBLISHED,
        includeHeader: true,
        includeFooter: true,
        includeLeftSidebar: true,
        includeRightSidebar: true,
        publishedAt: new Date(),
        createdBy: adminId,
      },
    })
  }
}

async function main() {
  const admin = await ensureAdminUser()
  const anonymousMaskUser = await ensureAnonymousMaskUser()
  const siteSettings = await ensureSiteSettings(anonymousMaskUser.id)

  await ensureLevelDefinitions()
  await ensureDefaultBadges()
  await ensureBaseTaxonomy()
  await ensureInviteCodes(admin.id)
  await ensureBuiltinCustomPages(admin.id, siteSettings)
  await ensureCampusDocs(admin.id)

  console.log(`Seed completed for ${APP_VERSION}.`)
  console.log(`Admin username: ${DEFAULT_ADMIN_USERNAME}`)
  console.log(`Admin password: ${DEFAULT_ADMIN_PASSWORD}`)
  console.log("Invite codes: CAMPUS2026, WALL2026, TEST2026")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })

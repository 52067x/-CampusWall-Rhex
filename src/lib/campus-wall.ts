import { prisma } from "@/db/client"
import { apiError } from "@/lib/api-route"

const PUBLIC_POST_STATUSES = ["NORMAL"] as const

export function normalizeWallPage(searchParams: URLSearchParams) {
  const page = Number(searchParams.get("page") ?? "1")
  const pageSize = Number(searchParams.get("pageSize") ?? "20")

  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: Number.isInteger(pageSize) ? Math.min(Math.max(pageSize, 1), 30) : 20,
  }
}

export function mapWallUser(user: {
  username: string
  nickname: string | null
  avatarPath: string | null
  level?: number | null
}) {
  return {
    username: user.username,
    nickname: user.nickname || user.username,
    avatar: user.avatarPath,
    level: user.level ?? 1,
  }
}

function readPlainContent(value: string) {
  try {
    const parsed = JSON.parse(value) as { blocks?: Array<{ text?: string; content?: string }> }
    if (Array.isArray(parsed.blocks)) {
      return parsed.blocks
        .map((block) => block.text || block.content || "")
        .filter(Boolean)
        .join("\n")
        .trim()
    }
  } catch {}

  return value
}

export function mapWallPost(post: {
  id: string
  slug: string
  title: string
  summary: string | null
  content: string
  isAnonymous: boolean
  viewCount: number
  commentCount: number
  likeCount: number
  favoriteCount: number
  createdAt: Date
  activityAt: Date
  board: {
    name: string
    slug: string
  }
  author: {
    username: string
    nickname: string | null
    avatarPath: string | null
    level?: number | null
  }
}) {
  const content = readPlainContent(post.content)
  const author = post.isAnonymous
    ? { username: "anonymous", nickname: "匿名同学", avatar: null, level: 1 }
    : mapWallUser(post.author)

  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    summary: post.summary || content.slice(0, 120),
    content,
    isAnonymous: post.isAnonymous,
    board: post.board,
    author,
    metrics: {
      views: post.viewCount,
      comments: post.commentCount,
      likes: post.likeCount,
      favorites: post.favoriteCount,
    },
    createdAt: post.createdAt.toISOString(),
    activityAt: post.activityAt.toISOString(),
  }
}

export async function getWallBoards() {
  const rows = await prisma.board.findMany({
    where: {
      status: "ACTIVE",
      allowPost: true,
    },
    orderBy: [
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      postCount: true,
      zone: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  })

  return rows.map((item) => ({
    id: item.id,
    name: item.name,
    slug: item.slug,
    description: item.description,
    postCount: item.postCount,
    zone: item.zone,
  }))
}

export async function getWallPosts(input: {
  page: number
  pageSize: number
  boardSlug?: string
  sort?: string
}) {
  const orderBy = input.sort === "hot"
    ? [{ score: "desc" as const }, { activityAt: "desc" as const }]
    : [{ isPinned: "desc" as const }, { activityAt: "desc" as const }]

  const where = {
    status: { in: [...PUBLIC_POST_STATUSES] },
    ...(input.boardSlug
      ? {
          board: {
            slug: input.boardSlug,
            status: "ACTIVE" as const,
          },
        }
      : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      orderBy,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        content: true,
        isAnonymous: true,
        viewCount: true,
        commentCount: true,
        likeCount: true,
        favoriteCount: true,
        createdAt: true,
        activityAt: true,
        board: {
          select: {
            name: true,
            slug: true,
          },
        },
        author: {
          select: {
            username: true,
            nickname: true,
            avatarPath: true,
            level: true,
          },
        },
      },
    }),
  ])

  return {
    list: rows.map(mapWallPost),
    page: input.page,
    pageSize: input.pageSize,
    total,
    hasMore: input.page * input.pageSize < total,
  }
}

export async function getWallPostDetail(postId: string) {
  const post = await prisma.post.findFirst({
    where: {
      OR: [
        { id: postId },
        { slug: postId },
      ],
      status: { in: [...PUBLIC_POST_STATUSES] },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      content: true,
      isAnonymous: true,
      viewCount: true,
      commentCount: true,
      likeCount: true,
      favoriteCount: true,
      createdAt: true,
      activityAt: true,
      board: {
        select: {
          name: true,
          slug: true,
        },
      },
      author: {
        select: {
          username: true,
          nickname: true,
          avatarPath: true,
          level: true,
        },
      },
      comments: {
        where: {
          status: "NORMAL",
          parentId: null,
        },
        orderBy: [
          { isPinnedByAuthor: "desc" },
          { createdAt: "asc" },
        ],
        take: 50,
        select: {
          id: true,
          content: true,
          useAnonymousIdentity: true,
          likeCount: true,
          createdAt: true,
          user: {
            select: {
              username: true,
              nickname: true,
              avatarPath: true,
              level: true,
            },
          },
        },
      },
    },
  })

  if (!post) {
    apiError(404, "动态不存在或已下架")
  }

  return {
    post: mapWallPost(post),
    comments: post.comments.map((comment) => ({
      id: comment.id,
      content: readPlainContent(comment.content),
      isAnonymous: comment.useAnonymousIdentity,
      author: comment.useAnonymousIdentity
        ? { username: "anonymous", nickname: "匿名同学", avatar: null, level: 1 }
        : mapWallUser(comment.user),
      likeCount: comment.likeCount,
      createdAt: comment.createdAt.toISOString(),
    })),
  }
}

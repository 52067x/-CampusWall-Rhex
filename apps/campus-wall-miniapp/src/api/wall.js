import { request } from "./request"

function buildQuery(params = {}) {
  return Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
    .join("&")
}

export function getBoards() {
  return request({ url: "/api/wall/boards" })
}

export function getPosts(params = {}) {
  const query = buildQuery(params)
  return request({ url: `/api/wall/posts${query ? `?${query}` : ""}` })
}

export function getPostDetail(postId) {
  return request({ url: `/api/wall/posts/${encodeURIComponent(postId)}` })
}

export function checkContent(data) {
  return request({
    url: "/api/wall/moderation/check",
    method: "POST",
    data,
  })
}

export function createPost(data) {
  return request({
    url: "/api/wall/posts",
    method: "POST",
    data,
  })
}

export function createComment(data) {
  return request({
    url: "/api/wall/comments",
    method: "POST",
    data,
  })
}


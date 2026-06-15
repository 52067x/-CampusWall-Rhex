const LOCAL_BACKEND_URL = "http://localhost:3000"
let DEFAULT_BASE_URL = LOCAL_BACKEND_URL

// #ifdef H5
DEFAULT_BASE_URL = ""
// #endif

const COOKIE_KEY = "campus_wall_cookie"
const BASE_URL_KEY = "campus_wall_api_base"

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "")
}

function getBaseUrl() {
  const stored = normalizeBaseUrl(uni.getStorageSync(BASE_URL_KEY))

  // #ifdef H5
  if (stored === LOCAL_BACKEND_URL || stored === "http://127.0.0.1:3000") {
    return DEFAULT_BASE_URL
  }
  // #endif

  return stored || DEFAULT_BASE_URL
}

function readSetCookie(header) {
  const value = header?.["Set-Cookie"] || header?.["set-cookie"]
  if (Array.isArray(value)) {
    return value.map((item) => String(item).split(";")[0]).join("; ")
  }
  return typeof value === "string" ? value.split(",").map((item) => item.split(";")[0]).join("; ") : ""
}

export function setApiBaseUrl(value) {
  const next = normalizeBaseUrl(value)
  if (next) {
    uni.setStorageSync(BASE_URL_KEY, next)
    return
  }

  uni.removeStorageSync(BASE_URL_KEY)
}

export function getApiBaseUrl() {
  return getBaseUrl()
}

export function clearSession() {
  uni.removeStorageSync(COOKIE_KEY)
}

export function request(options) {
  const cookie = uni.getStorageSync(COOKIE_KEY)
  const headers = {
    "Content-Type": "application/json",
    ...(options.header || {}),
  }

  // #ifndef H5
  if (cookie) {
    headers.Cookie = cookie
  }
  // #endif

  return new Promise((resolve, reject) => {
    uni.request({
      url: `${getBaseUrl()}${options.url}`,
      method: options.method || "GET",
      data: options.data || undefined,
      header: headers,
      success(response) {
        const nextCookie = readSetCookie(response.header)
        if (nextCookie) {
          uni.setStorageSync(COOKIE_KEY, nextCookie)
        }

        const body = response.data || {}
        if (response.statusCode >= 200 && response.statusCode < 300 && body.code === 0) {
          resolve(body.data)
          return
        }

        const message = body.message || `请求失败(${response.statusCode})`
        uni.showToast({ title: message, icon: "none" })
        reject(new Error(message))
      },
      fail(error) {
        uni.showToast({ title: "网络不可用", icon: "none" })
        reject(error)
      },
    })
  })
}

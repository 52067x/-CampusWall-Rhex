const DEFAULT_BASE_URL = "http://localhost:3001"
const COOKIE_KEY = "campus_wall_cookie"
const BASE_URL_KEY = "campus_wall_api_base"

function getBaseUrl() {
  return (uni.getStorageSync(BASE_URL_KEY) || DEFAULT_BASE_URL).replace(/\/+$/, "")
}

function readSetCookie(header) {
  const value = header?.["Set-Cookie"] || header?.["set-cookie"]
  if (Array.isArray(value)) {
    return value.map((item) => String(item).split(";")[0]).join("; ")
  }
  return typeof value === "string" ? value.split(",").map((item) => item.split(";")[0]).join("; ") : ""
}

export function setApiBaseUrl(value) {
  uni.setStorageSync(BASE_URL_KEY, String(value || "").trim() || DEFAULT_BASE_URL)
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
    ...(cookie ? { Cookie: cookie } : {}),
    ...(options.header || {}),
  }

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


import { getApiBaseUrl, getSessionCookie } from "./request"

function parseUploadResponse(data) {
  if (typeof data === "string") {
    try {
      return JSON.parse(data)
    } catch {
      return {}
    }
  }

  return data || {}
}

export function uploadImage(filePath, folder = "posts") {
  const header = {}

  // #ifndef H5
  const cookie = getSessionCookie()
  if (cookie) {
    header.Cookie = cookie
  }
  // #endif

  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${getApiBaseUrl()}/api/upload`,
      filePath,
      name: "file",
      formData: { folder },
      header,
      withCredentials: true,
      success(response) {
        const body = parseUploadResponse(response.data)
        if (response.statusCode >= 200 && response.statusCode < 300 && body.code === 0) {
          resolve(body.data)
          return
        }

        const message = body.message || `上传失败(${response.statusCode})`
        uni.showToast({ title: message, icon: "none" })
        reject(new Error(message))
      },
      fail(error) {
        uni.showToast({ title: "上传失败", icon: "none" })
        reject(error)
      },
    })
  })
}

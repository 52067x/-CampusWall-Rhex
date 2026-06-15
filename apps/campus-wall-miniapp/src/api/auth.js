import { clearSession, request } from "./request"

export function getMe() {
  return request({ url: "/api/auth/me" })
}

export function loginPassword(data) {
  return request({
    url: "/api/auth/login",
    method: "POST",
    data: {
      login: data.phone || data.login,
      password: data.password,
    },
  })
}

export function registerPhone(data) {
  return request({
    url: "/api/wall/auth/register",
    method: "POST",
    data,
  })
}

export function loginWechat(data) {
  return request({
    url: "/api/wall/auth/wechat",
    method: "POST",
    data,
  })
}

export function logoutServer() {
  return request({
    url: "/api/auth/logout",
    method: "POST",
    data: {},
  })
}

export function logoutLocal() {
  clearSession()
}

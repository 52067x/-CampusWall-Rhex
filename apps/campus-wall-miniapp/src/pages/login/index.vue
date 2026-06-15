<template>
  <view class="page login-page">
    <view class="surface login-card">
      <text class="title">校园墙</text>
      <view class="mode-tabs">
        <text :class="['mode', mode === 'login' ? 'active' : '']" @tap="mode = 'login'">登录</text>
        <text :class="['mode', mode === 'register' ? 'active' : '']" @tap="mode = 'register'">注册</text>
        <text :class="['mode', mode === 'wechat' ? 'active' : '']" @tap="mode = 'wechat'">微信</text>
      </view>

      <view v-if="mode === 'login'" class="form">
        <input v-model="phone" class="input" type="number" maxlength="11" placeholder="手机号" />
        <input v-model="password" class="input" password placeholder="密码" />
        <button class="btn" :disabled="submitting" @tap="submitLogin">{{ submitting ? "登录中..." : "登录" }}</button>
      </view>

      <view v-else-if="mode === 'register'" class="form">
        <input v-model="phone" class="input" type="number" maxlength="11" placeholder="手机号" />
        <input v-model="inviteCode" class="input" maxlength="32" placeholder="邀请码" />
        <input v-model="password" class="input" password placeholder="密码" />
        <input v-model="nickname" class="input" maxlength="20" placeholder="昵称" />
        <button class="btn" :disabled="submitting" @tap="submitRegister">{{ submitting ? "注册中..." : "注册并登录" }}</button>
      </view>

      <view v-else class="form">
        <input v-model="inviteCode" class="input" maxlength="32" placeholder="邀请码" />
        <input v-model="nickname" class="input" type="nickname" maxlength="20" placeholder="昵称" />
        <button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
          <image v-if="avatarUrl" :src="avatarUrl" class="avatar-img" mode="aspectFill" />
          <text v-else>头像</text>
        </button>
        <button class="btn" :disabled="submitting" @tap="submitWechat">{{ submitting ? "登录中..." : "微信登录" }}</button>
      </view>

      <view class="api-row">
        <input v-model="apiBaseUrl" class="api-input" placeholder="http://localhost:3001" />
        <button class="api-btn" @tap="saveApiBaseUrl">保存</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from "vue"
import { getApiBaseUrl, setApiBaseUrl } from "../../api/request"
import { loginPassword, loginWechat, registerPhone } from "../../api/auth"

const mode = ref("login")
const phone = ref("")
const password = ref("")
const inviteCode = ref("")
const nickname = ref("")
const avatarUrl = ref("")
const apiBaseUrl = ref(getApiBaseUrl())
const submitting = ref(false)

function saveApiBaseUrl() {
  setApiBaseUrl(apiBaseUrl.value)
  uni.showToast({ title: "已保存", icon: "success" })
}

function onChooseAvatar(event) {
  avatarUrl.value = event.detail.avatarUrl || ""
}

function requirePhonePassword() {
  if (!/^1\d{10}$/.test(phone.value)) {
    uni.showToast({ title: "手机号不正确", icon: "none" })
    return false
  }
  if (password.value.length < 6) {
    uni.showToast({ title: "密码至少 6 位", icon: "none" })
    return false
  }
  return true
}

async function submitLogin() {
  if (!requirePhonePassword() || submitting.value) return
  submitting.value = true
  try {
    await loginPassword({ phone: phone.value, password: password.value })
    uni.showToast({ title: "登录成功", icon: "success" })
    setTimeout(() => uni.switchTab({ url: "/pages/home/index" }), 400)
  } finally {
    submitting.value = false
  }
}

async function submitRegister() {
  if (!requirePhonePassword() || submitting.value) return
  if (!inviteCode.value.trim()) {
    uni.showToast({ title: "请填写邀请码", icon: "none" })
    return
  }
  submitting.value = true
  try {
    await registerPhone({
      phone: phone.value,
      password: password.value,
      inviteCode: inviteCode.value,
      nickname: nickname.value,
    })
    uni.showToast({ title: "注册成功", icon: "success" })
    setTimeout(() => uni.switchTab({ url: "/pages/home/index" }), 400)
  } finally {
    submitting.value = false
  }
}

function getWxCode() {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: "weixin",
      success: (res) => resolve(res.code),
      fail: reject,
    })
  })
}

async function submitWechat() {
  if (!inviteCode.value.trim()) {
    uni.showToast({ title: "请填写邀请码", icon: "none" })
    return
  }
  if (submitting.value) return
  submitting.value = true
  try {
    const code = await getWxCode()
    await loginWechat({
      code,
      inviteCode: inviteCode.value,
      nickname: nickname.value,
      avatarUrl: avatarUrl.value,
    })
    uni.showToast({ title: "登录成功", icon: "success" })
    setTimeout(() => uni.switchTab({ url: "/pages/home/index" }), 400)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

.login-card {
  width: 100%;
  padding: 34rpx 28rpx;
}

.title {
  display: block;
  margin-bottom: 24rpx;
  font-size: 46rpx;
  font-weight: 900;
  text-align: center;
}

.mode-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10rpx;
  margin-bottom: 24rpx;
  padding: 8rpx;
  border-radius: 14rpx;
  background: #eef2ef;
}

.mode {
  height: 60rpx;
  border-radius: 10rpx;
  color: #4b5563;
  font-size: 26rpx;
  line-height: 60rpx;
  text-align: center;
}

.mode.active {
  background: #ffffff;
  color: #0f766e;
  font-weight: 800;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.avatar-btn {
  width: 96rpx;
  height: 96rpx;
  margin: 0;
  border-radius: 24rpx;
  background: #163832;
  color: #fff;
  font-size: 24rpx;
  line-height: 96rpx;
}

.avatar-btn::after {
  border: 0;
}

.avatar-img {
  width: 96rpx;
  height: 96rpx;
  border-radius: 24rpx;
}

.api-row {
  display: flex;
  gap: 10rpx;
  margin-top: 28rpx;
}

.api-input {
  flex: 1;
  height: 68rpx;
  padding: 0 18rpx;
  border: 1rpx solid #d7ddd8;
  border-radius: 10rpx;
  font-size: 22rpx;
}

.api-btn {
  width: 112rpx;
  height: 68rpx;
  border-radius: 10rpx;
  background: #eef5f1;
  color: #0f766e;
  font-size: 24rpx;
  line-height: 68rpx;
}

.api-btn::after {
  border: 0;
}
</style>


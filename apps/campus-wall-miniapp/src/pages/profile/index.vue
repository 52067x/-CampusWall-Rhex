<template>
  <view class="page profile-page">
    <view class="surface profile-card">
      <view v-if="user" class="profile-head">
        <view class="avatar">
          <image v-if="user.avatarPath" :src="user.avatarPath" class="avatar-img" mode="aspectFill" />
          <text v-else>{{ avatarText }}</text>
        </view>
        <view class="profile-main">
          <text class="display-name">{{ user.displayName || user.nickname || user.username }}</text>
          <text class="muted username">@{{ user.username }}</text>
        </view>
        <text class="role-badge">{{ roleText }}</text>
      </view>

      <view v-else class="guest-panel">
        <text class="guest-title">未登录</text>
        <button class="btn" @tap="goLogin">登录 / 注册</button>
      </view>
    </view>

    <view v-if="user" class="stats-grid">
      <view class="surface stat-item">
        <text class="stat-value">{{ user.level || 1 }}</text>
        <text class="muted stat-label">等级</text>
      </view>
      <view class="surface stat-item">
        <text class="stat-value">{{ user.points || 0 }}</text>
        <text class="muted stat-label">积分</text>
      </view>
      <view class="surface stat-item">
        <text class="stat-value">{{ user.vipLevel || 0 }}</text>
        <text class="muted stat-label">VIP</text>
      </view>
    </view>

    <view class="surface settings-card">
      <text class="section-title">连接</text>
      <view class="api-row">
        <input v-model="apiBaseUrl" class="api-input" placeholder="http://localhost:3001" />
        <button class="api-btn" @tap="saveApiBaseUrl">保存</button>
      </view>
    </view>

    <view v-if="user" class="surface action-card">
      <button class="btn secondary" :disabled="loading" @tap="refresh">刷新资料</button>
      <button class="btn danger" :disabled="loading" @tap="logout">退出登录</button>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from "vue"
import { onShow } from "@dcloudio/uni-app"
import { getMe, logoutLocal, logoutServer } from "../../api/auth"
import { getApiBaseUrl, setApiBaseUrl } from "../../api/request"

const user = ref(null)
const loading = ref(false)
const apiBaseUrl = ref(getApiBaseUrl())

const avatarText = computed(() => String(user.value?.displayName || user.value?.nickname || user.value?.username || "同").slice(0, 1))
const roleText = computed(() => {
  if (!user.value) return ""
  if (user.value.role === "ADMIN") return "管理员"
  if (user.value.role === "MODERATOR") return "版主"
  return "同学"
})

function goLogin() {
  uni.navigateTo({ url: "/pages/login/index" })
}

function saveApiBaseUrl() {
  setApiBaseUrl(apiBaseUrl.value)
  apiBaseUrl.value = getApiBaseUrl()
  uni.showToast({ title: "已保存", icon: "success" })
}

async function refresh() {
  if (loading.value) return
  loading.value = true
  try {
    const data = await getMe()
    user.value = data.user || null
  } catch {
    user.value = null
  } finally {
    loading.value = false
  }
}

async function logout() {
  if (loading.value) return
  loading.value = true
  try {
    await logoutServer().catch(() => null)
    logoutLocal()
    user.value = null
    uni.showToast({ title: "已退出", icon: "success" })
  } finally {
    loading.value = false
  }
}

onShow(() => {
  apiBaseUrl.value = getApiBaseUrl()
  void refresh()
})
</script>

<style scoped>
.profile-page {
  padding-bottom: 40rpx;
}

.profile-card,
.settings-card,
.action-card {
  padding: 26rpx;
}

.profile-head {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 24rpx;
  background: #163832;
  color: #ffffff;
  text-align: center;
  line-height: 88rpx;
  font-size: 34rpx;
  font-weight: 800;
  overflow: hidden;
}

.avatar-img {
  width: 88rpx;
  height: 88rpx;
}

.profile-main {
  flex: 1;
  min-width: 0;
}

.display-name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 34rpx;
  font-weight: 900;
}

.username {
  display: block;
  margin-top: 6rpx;
  font-size: 23rpx;
}

.role-badge {
  min-width: 86rpx;
  height: 46rpx;
  border-radius: 999rpx;
  background: #fff3e8;
  color: #b45309;
  font-size: 22rpx;
  line-height: 46rpx;
  text-align: center;
}

.guest-panel {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.guest-title {
  font-size: 34rpx;
  font-weight: 900;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  margin-top: 18rpx;
}

.stat-item {
  padding: 22rpx 10rpx;
  text-align: center;
}

.stat-value {
  display: block;
  color: #0f766e;
  font-size: 34rpx;
  font-weight: 900;
}

.stat-label {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
}

.settings-card,
.action-card {
  margin-top: 18rpx;
}

.section-title {
  display: block;
  margin-bottom: 16rpx;
  font-size: 30rpx;
  font-weight: 800;
}

.api-row {
  display: flex;
  gap: 10rpx;
}

.api-input {
  flex: 1;
  height: 76rpx;
  padding: 0 18rpx;
  border: 1rpx solid #d7ddd8;
  border-radius: 10rpx;
  font-size: 24rpx;
}

.api-btn {
  width: 116rpx;
  height: 76rpx;
  border-radius: 10rpx;
  background: #eef5f1;
  color: #0f766e;
  font-size: 24rpx;
  line-height: 76rpx;
}

.api-btn::after {
  border: 0;
}

.action-card {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
</style>

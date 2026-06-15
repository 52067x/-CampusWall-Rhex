<template>
  <view class="page home-page">
    <view class="topbar" style="display: flex;justify-content: space-between; width: 100%;">
      <view >
        <text class="brand">校园墙</text>
        <text class="sub muted">Campus Wall</text>
      </view>
      <button class="quick-btn" @tap="goPublish">发布</button>
    </view>

    <scroll-view scroll-x class="board-tabs" :show-scrollbar="false" >
      <view class="tabs-inner" style="width: 1000rpx;">
        <text :class="['chip', !activeBoard ? 'active' : '']" style="width: 50rpx;" @tap="switchBoard('')">全部</text>
        <text style=""
          v-for="board in boards"
          :key="board.slug"
          :class="['chip', activeBoard === board.slug ? 'active' : '']"
          @tap="switchBoard(board.slug)"
        >
          {{ board.name }}
        </text>
      </view>
    </scroll-view>

    <view class="sort-row">
      <text :class="['sort-item', sort === 'new' ? 'active' : '']" @tap="switchSort('new')">最新</text>
      <text :class="['sort-item', sort === 'hot' ? 'active' : '']" @tap="switchSort('hot')">热度</text>
    </view>

    <view v-if="posts.length === 0 && !loading" class="empty surface">
      <text>暂无动态</text>
    </view>

    <view class="feed">
      <view v-for="post in posts" :key="post.id" class="post-card surface" @tap="openPost(post)">
        <view class="between">
          <view class="row author">
            <view class="avatar">{{ getAvatarText(post.author.nickname) }}</view>
            <view>
              <view class="name-line">
                <text class="name">{{ post.author.nickname }}</text>
                <text v-if="post.isAnonymous" class="badge">匿名</text>
              </view>
              <text class="meta muted">{{ post.board.name }} · {{ formatTime(post.createdAt) }}</text>
            </view>
          </view>
          <text class="score">{{ post.metrics.likes }}</text>
        </view>
        <text class="title">{{ post.title }}</text>
        <text class="summary">{{ post.summary }}</text>
        <view v-if="post.images && post.images.length" class="image-grid">
          <image
            v-for="(image, index) in post.images.slice(0, 3)"
            :key="image"
            class="post-image"
            :src="imageSrc(image)"
            mode="aspectFill"
            @tap.stop="previewPostImages(post.images, index)"
          />
        </view>
        <view class="metrics muted">
          <text>{{ post.metrics.comments }} 评论</text>
          <text>{{ post.metrics.views }} 浏览</text>
        </view>
      </view>
    </view>

    <view class="load-state muted">
      <text v-if="loading">加载中...</text>
      <text v-else-if="!hasMore && posts.length">已经到底</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from "vue"
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from "@dcloudio/uni-app"
import { getBoards, getPosts } from "../../api/wall"
import { resolveApiAssetUrl } from "../../api/request"

const boards = ref([])
const posts = ref([])
const page = ref(1)
const hasMore = ref(true)
const loading = ref(false)
const activeBoard = ref("")
const sort = ref("new")

function getAvatarText(name) {
  return String(name || "同").slice(0, 1)
}

function formatTime(value) {
  const date = new Date(value)
  const now = Date.now()
  const diff = Math.max(0, now - date.getTime())
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "刚刚"
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  return `${date.getMonth() + 1}-${date.getDate()}`
}

function imageSrc(urlPath) {
  return resolveApiAssetUrl(urlPath)
}

function previewPostImages(images, index) {
  uni.previewImage({
    current: index,
    urls: images.map((image) => imageSrc(image)),
  })
}

async function loadBoards() {
  const data = await getBoards()
  boards.value = data.boards || []
}

async function loadPosts(reset = false) {
  if (loading.value) return
  loading.value = true
  try {
    const nextPage = reset ? 1 : page.value
    const data = await getPosts({
      page: nextPage,
      pageSize: 12,
      board: activeBoard.value,
      sort: sort.value,
    })
    posts.value = reset ? data.list || [] : posts.value.concat(data.list || [])
    page.value = nextPage + 1
    hasMore.value = Boolean(data.hasMore)
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function switchBoard(slug) {
  activeBoard.value = slug
  hasMore.value = true
  void loadPosts(true)
}

function switchSort(value) {
  sort.value = value
  hasMore.value = true
  void loadPosts(true)
}

function openPost(post) {
  uni.navigateTo({ url: `/pages/detail/index?id=${post.id}` })
}

function goPublish() {
  uni.switchTab({ url: "/pages/publish/index" })
}

onLoad(async () => {
  await loadBoards()
  await loadPosts(true)
})

onShow(() => {
  if (uni.getStorageSync("campus_wall_posts_dirty")) {
    uni.removeStorageSync("campus_wall_posts_dirty")
    hasMore.value = true
    void loadPosts(true)
  }
})

onPullDownRefresh(() => {
  hasMore.value = true
  void loadPosts(true)
})

onReachBottom(() => {
  if (hasMore.value) {
    void loadPosts(false)
  }
})
</script>

<style scoped>
.home-page {
  padding-bottom: 40rpx;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.brand {
  display: block;
  font-size: 44rpx;
  font-weight: 800;
  letter-spacing: 0;
}

.sub {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
}

.quick-btn {
  width: 132rpx;
  height: 64rpx;
  border-radius: 999rpx;
  background: #f05d3b;
  color: #fff;
  font-size: 26rpx;
  line-height: 64rpx;
}

.quick-btn::after {
  border: 0;
}

.board-tabs {
  width: 100%;
  white-space: nowrap;
}

.tabs-inner {
  display: flex;
  gap: 14rpx;
  padding-bottom: 18rpx;
}

.sort-row {
  display: flex;
  gap: 28rpx;
  margin: 2rpx 0 20rpx;
  font-size: 26rpx;
}

.sort-item {
  color: #6b7280;
}

.sort-item.active {
  color: #0f766e;
  font-weight: 700;
}

.feed {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.post-card {
  padding: 24rpx;
}

.author {
  gap: 16rpx;
  min-width: 0;
}

.avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 18rpx;
  background: #163832;
  color: #ffffff;
  text-align: center;
  line-height: 64rpx;
  font-size: 28rpx;
  font-weight: 700;
}

.name-line {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.name {
  max-width: 360rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 26rpx;
  font-weight: 700;
}

.meta {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
}

.score {
  min-width: 48rpx;
  color: #f05d3b;
  font-size: 28rpx;
  font-weight: 800;
  text-align: right;
}

.title {
  display: block;
  margin-top: 22rpx;
  font-size: 32rpx;
  font-weight: 800;
  line-height: 1.35;
}

.summary {
  display: block;
  margin-top: 12rpx;
  color: #4b5563;
  font-size: 27rpx;
  line-height: 1.58;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10rpx;
  margin-top: 16rpx;
}

.post-image {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 12rpx;
  background: #eef2ef;
}

.metrics {
  display: flex;
  gap: 24rpx;
  margin-top: 18rpx;
  font-size: 23rpx;
}

.empty {
  padding: 80rpx 24rpx;
  text-align: center;
  color: #6b7280;
  font-size: 26rpx;
}

.load-state {
  padding: 28rpx 0;
  text-align: center;
  font-size: 24rpx;
}
</style>

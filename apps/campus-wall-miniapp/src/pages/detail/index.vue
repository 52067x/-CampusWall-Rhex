<template>
  <view class="page detail-page">
    <view v-if="post" class="surface post-detail">
      <view class="between">
        <view>
          <text class="board">{{ post.board.name }}</text>
          <text class="time muted">{{ formatTime(post.createdAt) }}</text>
        </view>
        <text v-if="post.isAnonymous" class="badge">匿名</text>
      </view>
      <text class="title">{{ post.title }}</text>
      <text v-if="post.content" class="content">{{ post.content }}</text>
      <view v-if="post.images && post.images.length" class="image-grid post-images">
        <image
          v-for="(image, index) in post.images"
          :key="image"
          class="content-image"
          :src="imageSrc(image)"
          mode="aspectFill"
          @tap="previewImages(post.images, index)"
        />
      </view>
      <view class="metrics muted">
        <text>{{ post.metrics.comments }} 评论</text>
        <text>{{ post.metrics.likes }} 赞</text>
        <text>{{ post.metrics.views }} 浏览</text>
      </view>
    </view>

    <view class="comment-panel surface">
      <text class="panel-title">评论</text>
      <view v-if="comments.length === 0" class="empty muted">暂无评论</view>
      <view v-for="comment in comments" :key="comment.id" class="comment-item">
        <view class="between">
          <view class="row author">
            <view class="avatar">{{ getAvatarText(comment.author.nickname) }}</view>
            <text class="name">{{ comment.author.nickname }}</text>
          </view>
          <text class="muted small">{{ formatTime(comment.createdAt) }}</text>
        </view>
        <text v-if="comment.content" class="comment-content">{{ comment.content }}</text>
        <view v-if="comment.images && comment.images.length" class="image-grid comment-images">
          <image
            v-for="(image, index) in comment.images"
            :key="image"
            class="content-image"
            :src="imageSrc(image)"
            mode="aspectFill"
            @tap="previewImages(comment.images, index)"
          />
        </view>
      </view>
    </view>

    <view class="reply-box surface">
      <textarea v-model="reply" class="textarea" maxlength="1000" placeholder="写评论" />
      <view v-if="replyImages.length" class="image-grid reply-images">
        <view v-for="(image, index) in replyImages" :key="image.urlPath" class="reply-image-item">
          <image class="content-image" :src="imageSrc(image.urlPath)" mode="aspectFill" @tap="previewReplyImage(index)" />
          <text class="remove-image" @tap.stop="removeReplyImage(index)">×</text>
        </view>
      </view>
      <button class="image-btn" :disabled="uploadingImages || replyImages.length >= 9" @tap="chooseReplyImages">
        {{ uploadingImages ? "上传中..." : replyImages.length >= 9 ? "最多 9 张" : "添加图片" }}
      </button>
      <button class="btn" :disabled="submitting" @tap="submitReply">{{ submitting ? "提交中..." : "发送" }}</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from "vue"
import { onLoad, onPullDownRefresh } from "@dcloudio/uni-app"
import { checkContent, createComment, getPostDetail } from "../../api/wall"
import { resolveApiAssetUrl } from "../../api/request"
import { uploadImage } from "../../api/upload"

const postId = ref("")
const post = ref(null)
const comments = ref([])
const reply = ref("")
const replyImages = ref([])
const submitting = ref(false)
const uploadingImages = ref(false)

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

function buildReplyContent() {
  const text = reply.value.trim()
  const imageMarkdown = replyImages.value.map((image) => `![](${image.urlPath})`).join("\n")
  return [text, imageMarkdown].filter(Boolean).join("\n\n")
}

function chooseReplyImages() {
  if (uploadingImages.value || replyImages.value.length >= 9) return

  uni.chooseImage({
    count: Math.max(1, 9 - replyImages.value.length),
    sizeType: ["compressed"],
    sourceType: ["album", "camera"],
    async success(result) {
      const paths = result.tempFilePaths || []
      if (!paths.length) return
      uploadingImages.value = true
      try {
        for (const filePath of paths) {
          const uploaded = await uploadImage(filePath, "comments")
          if (uploaded?.urlPath) {
            replyImages.value.push({ urlPath: uploaded.urlPath })
          }
        }
      } finally {
        uploadingImages.value = false
      }
    },
  })
}

function removeReplyImage(index) {
  replyImages.value.splice(index, 1)
}

function previewImages(images, index) {
  uni.previewImage({
    current: index,
    urls: images.map((image) => imageSrc(image)),
  })
}

function previewReplyImage(index) {
  previewImages(replyImages.value.map((image) => image.urlPath), index)
}

async function loadDetail() {
  if (!postId.value) return
  try {
    const data = await getPostDetail(postId.value)
    post.value = data.post
    comments.value = data.comments || []
  } finally {
    uni.stopPullDownRefresh()
  }
}

async function submitReply() {
  const content = buildReplyContent()
  if (!content || submitting.value) {
    return
  }
  submitting.value = true
  try {
    const moderation = await checkContent({
      targetType: "comment",
      content,
    })
    if (moderation.decision === "REJECT") {
      uni.showToast({ title: "评论未通过审核", icon: "none" })
      return
    }
    const result = await createComment({
      postId: post.value.id,
      content,
      commentView: "tree",
    })
    uni.showToast({ title: result.reviewRequired ? "已提交审核" : "评论成功", icon: "success" })
    reply.value = ""
    replyImages.value = []
    await loadDetail()
  } catch (error) {
    if (String(error?.message || "").includes("登录")) {
      uni.navigateTo({ url: "/pages/login/index" })
    }
  } finally {
    submitting.value = false
  }
}

onLoad((options) => {
  postId.value = options?.id || ""
  void loadDetail()
})

onPullDownRefresh(() => {
  void loadDetail()
})
</script>

<style scoped>
.detail-page {
  padding-bottom: 32rpx;
}

.post-detail {
  padding: 28rpx;
}

.board {
  display: block;
  color: #0f766e;
  font-size: 24rpx;
  font-weight: 700;
}

.time {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
}

.title {
  display: block;
  margin-top: 26rpx;
  font-size: 38rpx;
  font-weight: 800;
  line-height: 1.35;
}

.content {
  display: block;
  margin-top: 20rpx;
  color: #25322d;
  font-size: 29rpx;
  line-height: 1.7;
  white-space: pre-wrap;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
}

.post-images {
  margin-top: 18rpx;
}

.content-image,
.reply-image-item {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 12rpx;
  background: #eef2ef;
}

.content-image {
  display: block;
}

.metrics {
  display: flex;
  gap: 24rpx;
  margin-top: 24rpx;
  font-size: 23rpx;
}

.comment-panel {
  margin-top: 20rpx;
  padding: 24rpx;
}

.panel-title {
  display: block;
  margin-bottom: 14rpx;
  font-size: 30rpx;
  font-weight: 800;
}

.empty {
  padding: 34rpx 0;
  text-align: center;
  font-size: 24rpx;
}

.comment-item {
  padding: 22rpx 0;
  border-top: 1rpx solid #edf0ed;
}

.author {
  gap: 12rpx;
}

.avatar {
  width: 48rpx;
  height: 48rpx;
  border-radius: 14rpx;
  background: #163832;
  color: #fff;
  text-align: center;
  line-height: 48rpx;
  font-size: 22rpx;
  font-weight: 700;
}

.name {
  font-size: 25rpx;
  font-weight: 700;
}

.small {
  font-size: 22rpx;
}

.comment-content {
  display: block;
  margin-top: 12rpx;
  color: #374151;
  font-size: 27rpx;
  line-height: 1.55;
}

.comment-images {
  margin-top: 14rpx;
}

.reply-box {
  margin-top: 20rpx;
  padding: 20rpx;
}

.reply-box .textarea {
  min-height: 160rpx;
  margin-bottom: 18rpx;
}

.reply-images {
  margin-bottom: 18rpx;
}

.reply-image-item {
  position: relative;
  overflow: hidden;
}

.remove-image {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  width: 38rpx;
  height: 38rpx;
  border-radius: 999rpx;
  background: rgba(23, 32, 28, 0.74);
  color: #fff;
  font-size: 28rpx;
  line-height: 36rpx;
  text-align: center;
}

.image-btn {
  height: 70rpx;
  margin-bottom: 18rpx;
  border-radius: 12rpx;
  background: #eef5f1;
  color: #0f766e;
  font-size: 26rpx;
  line-height: 70rpx;
}

.image-btn::after {
  border: 0;
}
</style>

<template>
  <view class="page publish-page">
    <view class="surface form-card">
      <view class="between section-head">
        <text class="section-title">发布动态</text>
        <switch :checked="isAnonymous" color="#0f766e" @change="isAnonymous = $event.detail.value" />
      </view>
      <text class="anonymous-label muted">匿名</text>

      <picker :range="boardNames" :value="boardIndex" @change="onBoardChange">
        <view class="picker-field">
          <text>{{ activeBoardName || "选择频道" }}</text>
          <text class="muted">›</text>
        </view>
      </picker>

      <input v-model="title" class="input" maxlength="80" placeholder="标题" />
      <textarea v-model="content" class="textarea" maxlength="5000" placeholder="正文" />

      <view v-if="images.length" class="image-grid">
        <view v-for="(image, index) in images" :key="image.urlPath" class="image-item">
          <image class="picked-image" :src="imageSrc(image.urlPath)" mode="aspectFill" @tap="previewImage(index)" />
          <text class="remove-image" @tap.stop="removeImage(index)">×</text>
        </view>
      </view>

      <button class="image-btn" :disabled="uploadingImages || images.length >= 9" @tap="chooseImages">
        {{ uploadingImages ? "上传中..." : images.length >= 9 ? "最多 9 张" : "添加图片" }}
      </button>

      <view v-if="moderation" class="moderation-box">
        <view class="between">
          <text class="moderation-title">审核结果</text>
          <text :class="['decision', moderation.decision.toLowerCase()]">{{ decisionText }}</text>
        </view>
        <text class="moderation-reason">{{ moderation.reason }}</text>
      </view>

      <button class="btn submit-btn" :disabled="submitting" @tap="submit">
        {{ submitting ? "提交中..." : "发布" }}
      </button>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from "vue"
import { onShow } from "@dcloudio/uni-app"
import { checkContent, createPost, getBoards } from "../../api/wall"
import { resolveApiAssetUrl } from "../../api/request"
import { uploadImage } from "../../api/upload"

const boards = ref([])
const boardIndex = ref(0)
const title = ref("")
const content = ref("")
const images = ref([])
const isAnonymous = ref(false)
const submitting = ref(false)
const uploadingImages = ref(false)
const moderation = ref(null)

const boardNames = computed(() => boards.value.map((item) => item.name))
const activeBoard = computed(() => boards.value[boardIndex.value] || null)
const activeBoardName = computed(() => activeBoard.value?.name || "")
const decisionText = computed(() => {
  if (!moderation.value) return ""
  if (moderation.value.decision === "REJECT") return "拒绝"
  if (moderation.value.decision === "REVIEW") return "复核"
  return "通过"
})

async function ensureBoards() {
  const data = await getBoards()
  boards.value = data.boards || []
  if (boardIndex.value >= boards.value.length) {
    boardIndex.value = 0
  }
}

function onBoardChange(event) {
  boardIndex.value = Number(event.detail.value || 0)
}

function imageSrc(urlPath) {
  return resolveApiAssetUrl(urlPath)
}

function buildContentWithImages() {
  const text = content.value.trim()
  const imageMarkdown = images.value.map((image) => `![](${image.urlPath})`).join("\n")
  return [text, imageMarkdown].filter(Boolean).join("\n\n")
}

function chooseImages() {
  if (uploadingImages.value || images.value.length >= 9) return

  uni.chooseImage({
    count: Math.max(1, 9 - images.value.length),
    sizeType: ["compressed"],
    sourceType: ["album", "camera"],
    async success(result) {
      const paths = result.tempFilePaths || []
      if (!paths.length) return
      uploadingImages.value = true
      try {
        for (const filePath of paths) {
          const uploaded = await uploadImage(filePath, "posts")
          if (uploaded?.urlPath) {
            images.value.push({ urlPath: uploaded.urlPath })
          }
        }
      } finally {
        uploadingImages.value = false
      }
    },
  })
}

function removeImage(index) {
  images.value.splice(index, 1)
}

function previewImage(index) {
  uni.previewImage({
    current: index,
    urls: images.value.map((image) => imageSrc(image.urlPath)),
  })
}

function validate() {
  if (!activeBoard.value) {
    uni.showToast({ title: "请选择频道", icon: "none" })
    return false
  }
  if (title.value.trim().length < 2) {
    uni.showToast({ title: "标题太短", icon: "none" })
    return false
  }
  if (content.value.trim().length < 2 && images.value.length === 0) {
    uni.showToast({ title: "正文太短", icon: "none" })
    return false
  }
  return true
}

async function submit() {
  if (!validate() || submitting.value) return
  const finalContent = buildContentWithImages()
  submitting.value = true
  try {
    moderation.value = await checkContent({
      targetType: "post",
      title: title.value,
      content: finalContent,
    })
    if (moderation.value.decision === "REJECT") {
      uni.showToast({ title: "内容未通过审核", icon: "none" })
      return
    }
    const result = await createPost({
      title: title.value,
      content: finalContent,
      boardSlug: activeBoard.value.slug,
      isAnonymous: isAnonymous.value,
      postType: "NORMAL",
    })
    uni.showToast({ title: result.reviewRequired ? "已提交审核" : "发布成功", icon: "success" })
    title.value = ""
    content.value = ""
    images.value = []
    isAnonymous.value = false
    moderation.value = null
    uni.setStorageSync("campus_wall_posts_dirty", "1")
    setTimeout(() => uni.switchTab({ url: "/pages/home/index" }), 500)
  } catch (error) {
    if (String(error?.message || "").includes("登录")) {
      uni.navigateTo({ url: "/pages/login/index" })
    }
  } finally {
    submitting.value = false
  }
}

onShow(() => {
  void ensureBoards()
})
</script>

<style scoped>
.form-card {
  padding: 26rpx;
}

.section-head {
  margin-bottom: 4rpx;
}

.section-title {
  font-size: 36rpx;
  font-weight: 800;
}

.anonymous-label {
  display: block;
  margin-bottom: 22rpx;
  font-size: 24rpx;
}

.picker-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 84rpx;
  margin-bottom: 18rpx;
  padding: 0 24rpx;
  border: 1rpx solid #d7ddd8;
  border-radius: 12rpx;
  background: #fff;
  font-size: 28rpx;
}

.input {
  margin-bottom: 18rpx;
}

.textarea {
  min-height: 360rpx;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 18rpx;
}

.image-item {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 12rpx;
  background: #eef2ef;
}

.picked-image {
  width: 100%;
  height: 100%;
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
  margin-top: 18rpx;
  border-radius: 12rpx;
  background: #eef5f1;
  color: #0f766e;
  font-size: 26rpx;
  line-height: 70rpx;
}

.image-btn::after {
  border: 0;
}

.moderation-box {
  margin-top: 18rpx;
  padding: 20rpx;
  border-radius: 14rpx;
  background: #f4f7f5;
}

.moderation-title {
  font-size: 26rpx;
  font-weight: 700;
}

.decision {
  font-size: 24rpx;
  font-weight: 800;
}

.decision.pass {
  color: #0f766e;
}

.decision.review {
  color: #b45309;
}

.decision.reject {
  color: #b42318;
}

.moderation-reason {
  display: block;
  margin-top: 10rpx;
  color: #4b5563;
  font-size: 24rpx;
  line-height: 1.55;
}

.submit-btn {
  margin-top: 28rpx;
}
</style>

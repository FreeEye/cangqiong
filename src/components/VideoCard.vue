<script setup>
import { Play } from 'lucide-vue-next'

defineProps({
  video: {
    type: Object,
    required: true
  }
})
</script>

<template>
  <div class="group relative flex flex-col gap-2 cursor-pointer">
    <!-- 封面容器 -->
    <div class="relative aspect-[2/3] overflow-hidden rounded-xl bg-gray-800 shadow-lg transition-all duration-300 group-hover:shadow-purple-500/20 group-hover:ring-2 group-hover:ring-purple-500/50">
      <!-- 图片 -->
      <img
        :src="video.vod_pic"
        :alt="video.vod_name"
        class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        loading="lazy"
      >

      <!-- 渐变遮罩 -->
      <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 transition-opacity group-hover:opacity-80" />

      <!-- 右上角角标 -->
      <div class="absolute top-2 right-2 rounded-md bg-black/60 px-2 py-1 text-xs font-bold text-purple-300 backdrop-blur-sm">
        {{ video.vod_remarks }}
      </div>

      <!-- 悬浮播放按钮 -->
      <div class="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100 scale-50">
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg shadow-purple-600/40">
          <Play class="h-6 w-6 fill-current" />
        </div>
      </div>
    </div>

    <!-- 标题信息 -->
    <div class="space-y-1 px-1">
      <h3 class="truncate text-sm font-medium text-gray-200 group-hover:text-purple-400">
        {{ video.vod_name }}
      </h3>
      <p class="text-xs text-gray-500">
        {{ video.vod_year }}
      </p>
    </div>
  </div>
</template>

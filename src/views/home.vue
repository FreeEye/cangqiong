<script setup>
import { onMounted, ref, onUnmounted } from 'vue'
import NavBar from '@/components/NavBar.vue'
import VideoCard from '@/components/VideoCard.vue'
import { PlayCircle, Calendar, MapPin, Layers, Eye } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

// 初始状态为 null，等待接口返回
const featuredVideo = ref(null)
const videoList = ref([])

// 实时观看人数
const liveViewers = ref(0)

const router = useRouter()

const goToDetail = (id) => {
  router.push(`/player/${id}`)
}

// 辅助函数：去除 HTML 标签（防止简介里有 <p>）
const stripHtml = (html) => {
  if (!html) return ''
  return html.replace(/<[^>]*>?/gm, '')
}

// 加载实时观看人数
const loadLiveViewers = () => {
  const savedViewers = localStorage.getItem('liveViewers')
  if (savedViewers) {
    liveViewers.value = parseInt(savedViewers)
  } else {
    liveViewers.value = Math.floor(Math.random() * 1000) + 500
    localStorage.setItem('liveViewers', liveViewers.value.toString())
  }
}

// 更新实时观看人数
const updateLiveViewers = () => {
  // 每次访问增加观看人数
  liveViewers.value++
  localStorage.setItem('liveViewers', liveViewers.value.toString())
  // 广播更新事件
  window.dispatchEvent(new CustomEvent('liveViewersUpdated'))
}

onMounted(async () => {
  loadLiveViewers()
  updateLiveViewers()

  // 监听实时观看人数更新
  window.addEventListener('liveViewersUpdated', () => {
    const savedViewers = localStorage.getItem('liveViewers')
    if (savedViewers) {
      liveViewers.value = parseInt(savedViewers)
    }
  })

  try {
    const res = await fetch('/api/proxy?ac=detail')
    const data = await res.json()

    videoList.value = data.list

    // 【优化逻辑】
    // 不直接取第0个，而是找第一条图片不是空的、且有简介的数据作为 Banner
    // 如果没有筛选条件，直接取 list[0] 也可以
    if (data.list && data.list.length > 0) {
      featuredVideo.value = data.list[0]
    }
  } catch (error) {
    console.error('加载失败', error)
  }
})

onUnmounted(() => {
  window.removeEventListener('liveViewersUpdated', () => {})
})

const goDetail = () => {
  router.push('/category/1')
}
</script>

<template>
  <div class="min-h-screen pb-20 bg-[#0f1014]">
    <NavBar />

    <!-- 实时观看人数显示 -->
    <div class="fixed top-20 right-4 z-50 flex items-center gap-2 bg-purple-600/80 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg">
      <Eye class="w-4 h-4 text-white animate-pulse" />
      <span class="text-white text-sm font-medium">{{ liveViewers }} 人在看</span>
    </div>

    <!-- Hero Section (重构版) -->
    <!-- 使用 v-if 确保有数据再渲染，避免闪烁 -->
    <header v-if="featuredVideo" class="relative w-full overflow-hidden h-[560px] md:min-h-[600px] flex flex-col justify-end md:justify-center md:flex-row md:items-center">
      <!-- 1. PC端：宽屏背景 (仅在 md 以上显示) -->
      <div class="hidden md:block absolute inset-0 z-0">
        <img
          :src="featuredVideo.vod_pic"
          class="h-full w-full object-cover opacity-40 blur-3xl scale-125 saturate-150"
        >
        <div class="absolute inset-0 bg-gradient-to-t from-[#0f1014] via-[#0f1014]/60 to-transparent" />
        <div class="absolute inset-0 bg-gradient-to-r from-[#0f1014] via-[#0f1014]/50 to-transparent" />
      </div>

      <!-- 2. 【核心修改】移动端：全屏沉浸背景 -->
      <!-- 说明：md:hidden 仅在移动端显示。inset-0 铺满全屏，不再留白。 -->
      <div class="absolute inset-0 z-0 md:hidden select-none pointer-events-none">
        <!-- 图片：铺满，object-cover 保证不拉伸，object-top 保证人脸显示在顶部空旷区 -->
        <img
          :src="featuredVideo.vod_pic"
          class="w-full h-full object-cover object-top opacity-100"
        >

        <!-- 顶部遮罩：稍微压暗顶部，防止顶部导航栏看不清 -->
        <div class="absolute inset-0 bg-gradient-to-b from-[#0f1014]/80 via-transparent to-transparent h-32" />

        <!-- 底部强力遮罩：解决“看不清”问题 -->
        <!-- from-[#0f1014] (纯黑) 开始，向上渐变，给文字提供完美的黑色背景板 -->
        <div class="absolute inset-0 bg-gradient-to-t from-[#0f1014] via-[#0f1014]/90 via-40% to-transparent" />
      </div>

      <!-- 3. 内容容器 -->
      <!-- 修改点：pb-12 (底部留出空间), md:pt-24 (PC端顶部留白), z-10 保证在遮罩之上 -->
      <div class="relative z-10 mx-auto flex w-full max-w-7xl flex-col md:flex-row items-center gap-6 md:gap-8 px-4 pb-8 md:pb-12 md:pt-24 sm:px-6 lg:px-8">
        <!-- 左侧：文字信息 -->
        <!-- 修改点：移动端 text-center (居中), PC端 text-left -->
        <div class="flex-1 space-y-4 md:space-y-6 text-center md:text-left w-full">
          <!-- 标签组 -->
          <div class="flex flex-wrap items-center justify-center md:justify-start gap-2 md:gap-3">
            <span class="px-3 py-1 rounded-full bg-purple-600 shadow-[0_0_15px_rgba(147,51,234,0.5)] text-xs font-bold text-white">
              最新上线
            </span>
            <!-- 增加背景不透明度，确保清晰 -->
            <span class="flex items-center gap-1 text-xs font-medium text-gray-200 bg-black/40 border border-white/10 px-2 py-1 rounded backdrop-blur-md">
              <Calendar class="w-3 h-3" /> {{ featuredVideo.vod_year || '2025' }}
            </span>
            <span class="flex items-center gap-1 text-xs font-medium text-gray-200 bg-black/40 border border-white/10 px-2 py-1 rounded backdrop-blur-md">
              <MapPin class="w-3 h-3" /> {{ featuredVideo.vod_area || '未知' }}
            </span>
            <span class="flex items-center gap-1 text-xs font-medium text-gray-200 bg-black/40 border border-white/10 px-2 py-1 rounded backdrop-blur-md">
              <Layers class="w-3 h-3" /> {{ featuredVideo.type_name || '精选' }}
            </span>
          </div>

          <!-- 标题 -->
          <!-- 修改：移动端字号 text-4xl，增加 drop-shadow 增强对比 -->
          <h1 class="text-4xl font-extrabold text-white sm:text-5xl lg:text-6xl leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
            {{ featuredVideo.vod_name }}
          </h1>

          <!-- 简介 -->
          <!-- 修改：移动端只显示 2 行 (line-clamp-2)，防止占满屏幕 -->
          <p class="mx-auto md:mx-0 max-w-2xl text-sm md:text-base text-gray-300 line-clamp-2 md:line-clamp-3 leading-relaxed drop-shadow-md">
            {{ stripHtml(featuredVideo.vod_blurb || featuredVideo.vod_content) }}
          </p>

          <!-- 按钮组 -->
          <div class="flex items-center justify-center md:justify-start gap-4 pt-2">
            <button
              @click="goToDetail(featuredVideo.vod_id)"
              class="cursor-pointer w-full md:w-auto group flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-8 py-3.5 font-bold text-white transition-all hover:bg-purple-700 hover:scale-105 shadow-lg shadow-purple-600/30"
            >
              <PlayCircle class="h-5 w-5 fill-current transition-transform group-hover:rotate-12" />
              立即播放
            </button>
          </div>
        </div>

        <!-- 右侧：PC端海报 (移动端隐藏) -->
        <div class="hidden md:block w-[280px] lg:w-[320px] flex-shrink-0 relative group">
          <div class="absolute -inset-1 bg-gradient-to-tr from-purple-600 to-blue-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500" />
          <img
            :src="featuredVideo.vod_pic"
            class="relative w-full rounded-xl shadow-2xl shadow-black/50 border border-white/10 transform transition duration-500 group-hover:-translate-y-2 object-cover aspect-[2/3]"
            alt="Featured Poster"
          >
        </div>
      </div>
    </header>

    <!-- 加载占位符 (骨架屏) -->
    <header v-else class="h-[600px] w-full flex items-center justify-center bg-[#0f1014]">
      <div class="animate-pulse flex flex-col items-center gap-4">
        <div class="h-8 w-64 bg-white/5 rounded" />
        <div class="h-4 w-48 bg-white/5 rounded" />
      </div>
    </header>

    <!-- 列表区 -->
    <main class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 relative z-20">
      <div class="mb-8 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-1 h-6 bg-purple-600 rounded-full" />
          <h2 class="text-2xl font-bold text-white tracking-wide">
            最新更新
          </h2>
        </div>
        <button @click="goDetail" class="flex cursor-pointer items-center gap-2 rounded-xl bg-white/10 border border-white/10 px-6 py-2 font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20 hover:border-white/20">
          查看全部
        </button>
      </div>

      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:gap-6">
        <VideoCard
          v-for="video in videoList"
          :key="video.vod_id"
          :video="video"
          @click="goToDetail(video.vod_id)"
        />
      </div>
    </main>

    <!-- 版权声明 -->
    <footer class="mt-16 border-t border-white/10 pt-8">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="text-center text-gray-400 text-sm leading-relaxed">
          <p class="mb-4">
            本网站所有内容均来自互联网分享站点所提供的公开引用资源，未提供影视资源上传、存储服务，如有侵权，请联系删除。
          </p>
          <p class="text-xs text-gray-500">
            © 2025 苍穹影视 - 高清在线视频播放平台
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

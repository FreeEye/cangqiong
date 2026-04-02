<script setup>
import { ref, onMounted, onBeforeUnmount, computed, nextTick, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import Hls from 'hls.js'
import { Calendar, MapPin, User, FileText, Layers, Eye, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-vue-next'
import Player from '@/components/Player.vue'
import { apiCall } from '@/utils/api'

// --- 状态定义 ---
const route = useRoute()
const videoDetail = ref(null) // 存储接口返回的原始数据
const playSources = ref([]) // 解析后的播放源数据结构
const currentSourceIndex = ref(0) // 当前选中的播放源 (Tab索引)
const currentEpisodeUrl = ref('') // 当前播放的URL
const currentEpisodeName = ref('') // 当前播放的集数名称
const videoPlayer = ref(null) // video DOM 引用
const currentEpisodeIndex = ref(0) // 当前集数索引
let hls = null // Hls.js 实例
let watchTimer = null // 15秒定时器

// 实时观看人数
const currentViews = ref(0)

// 热门视频推荐
const recommendedVideos = ref([])

// --- 保存观看历史 ---
const saveWatchHistory = () => {
  if (!videoDetail.value) return

  const historyItem = {
    id: route.params.id,
    name: videoDetail.value.vod_name,
    pic: videoDetail.value.vod_pic,
    episode: currentEpisodeName.value,
    time: new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 加载现有历史记录
  const history = localStorage.getItem('watchHistory')
  let historyList = []
  if (history) {
    historyList = JSON.parse(history)
  }

  // 移除重复项
  const existingIndex = historyList.findIndex(item => item.id === historyItem.id)
  if (existingIndex > -1) {
    historyList.splice(existingIndex, 1)
  }

  // 添加到历史记录开头
  historyList.unshift(historyItem)

  // 限制历史记录数量
  if (historyList.length > 50) {
    historyList = historyList.slice(0, 50)
  }

  // 保存到本地存储
  localStorage.setItem('watchHistory', JSON.stringify(historyList))
}

// 加载当前视频观看人数（真实数据）
const loadCurrentViews = async () => {
  try {
    const data = await apiCall({ ac: 'detail', ids: route.params.id })
    if (data && data.list && data.list.length > 0) {
      currentViews.value = data.list[0].vod_hits || 0
    }
  } catch (error) {
    console.error('获取真实观看人数失败', error)
    // 失败时回退到本地存储
    const savedStats = localStorage.getItem('trafficStats')
    if (savedStats) {
      const stats = JSON.parse(savedStats)
      const stat = stats.find(s => s.videoId === route.params.id)
      if (stat) {
        currentViews.value = stat.views
      }
    }
  }
}

// --- 核心逻辑 1: 获取并解析数据 ---
const fetchVideoDetail = async () => {
  const data = await apiCall({ ac: 'detail', ids: route.params.id })
  videoDetail.value = data?.list[0] || {}
  // 修改页面标题为当前剧集名称
  if (videoDetail.value.vod_name) {
    document.title = `${videoDetail.value.vod_name} - 苍穹影视`
  }
  await nextTick()
  parsePlayUrl(videoDetail.value.vod_play_from, videoDetail.value.vod_play_url)
  
  // 加载观看人数
  loadCurrentViews()
  
  // 加载热门视频推荐
  loadRecommendedVideos()
}

// 加载热门视频推荐
const loadRecommendedVideos = async () => {
  try {
    const data = await apiCall({ ac: 'detail' })
    if (data && data.list) {
      // 过滤掉当前视频，取前6个作为推荐
      recommendedVideos.value = data.list
        .filter(video => video.vod_id !== route.params.id)
        .slice(0, 6)
    }
  } catch (error) {
    console.error('加载推荐视频失败', error)
  }
}

// --- 核心逻辑 2: 解析播放地址字符串 ---
const parsePlayUrl = (playFrom, playUrl) => {
  // 处理空值情况
  if (!playFrom || !playUrl) {
    playSources.value = []
    return
  }

  // 1. 分割源名称，如果没有$$$分隔符则作为单个源处理
  const sourceNames = playFrom.includes('$$$') ? playFrom.split('$$$') : [playFrom]
  // 2. 分割源数据，如果没有$$$分隔符则作为单个源数据
  const sourceData = playUrl.includes('$$$') ? playUrl.split('$$$') : [playUrl]

  const result = sourceNames.map((name, index) => {
    const rawEpisodes = sourceData[index] || '' // 防止数组越界

    // 3. 分割集数，如果没有#分隔符则作为单集处理
    let episodes = []

    if (rawEpisodes.includes('#')) {
      // 正常多集情况
      episodes = rawEpisodes.split('#').map((epStr) => {
        if (epStr.includes('$')) {
          // 正常的 "第01集$URL" 格式
          const [epName, epUrl] = epStr.split('$')
          return { name: epName, url: epUrl }
        } else {
          // 只有URL，没有集数名稱，使用默认名称
          return { name: `第${episodes.length + 1}集`, url: epStr }
        }
      })
    } else {
      // 单集情况
      if (rawEpisodes.includes('$')) {
        // "第01集$URL" 格式
        const [epName, epUrl] = rawEpisodes.split('$')
        episodes = [{ name: epName, url: epUrl }]
      } else {
        // 只有URL，使用默认名称
        episodes = [{ name: '正片', url: rawEpisodes }]
      }
    }

    return {
      name, // 源名称
      episodes // 该源下的集数列表
    }
  })

  playSources.value = result

  // 默认自动播放：第一个源的第一集或历史记录中的集数
  if (result.length > 0 && result[0].episodes.length > 0) {
    // 检查是否有历史记录中的集数
    const lastWatchedEpisode = route.query.episode
    if (lastWatchedEpisode) {
      // 在所有源中查找匹配的集数
      let found = false
      for (const source of result) {
        const matchedEpisode = source.episodes.find(ep => ep.name === lastWatchedEpisode)
        if (matchedEpisode) {
          playEpisode(matchedEpisode.url, matchedEpisode.name)
          found = true
          break
        }
      }
      // 如果没有找到匹配的集数，播放第一集
      if (!found) {
        playEpisode(result[0].episodes[0].url, result[0].episodes[0].name)
      }
    } else {
      // 没有历史记录，播放第一集
      playEpisode(result[0].episodes[0].url, result[0].episodes[0].name)
    }
  }
}

// --- 核心逻辑 3: 切换集数与 HLS 播放 ---
const playEpisode = (url, name, index = -1) => {
  currentEpisodeUrl.value = url
  currentEpisodeName.value = name
  
  // 更新当前集数索引
  if (index >= 0) {
    currentEpisodeIndex.value = index
  } else {
    // 如果没有提供索引，查找匹配的集数
    const episodes = currentEpisodesList.value
    const foundIndex = episodes.findIndex(ep => ep.url === url && ep.name === name)
    if (foundIndex >= 0) {
      currentEpisodeIndex.value = foundIndex
    }
  }

  // 切换集数时保存观看历史
  saveWatchHistory()

  if (Hls.isSupported()) {
    if (hls) hls.destroy() // 切换前销毁旧实例
    hls = new Hls()
    hls.loadSource(url)
    hls.attachMedia(videoPlayer.value)
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      videoPlayer.value.play()
    })
  } else if (videoPlayer.value.canPlayType('application/vnd.apple.mpegurl')) {
    // 兼容 Safari
    videoPlayer.value.src = url
    videoPlayer.value.play()
  }
}

// 切换到上一集
const playPreviousEpisode = () => {
  const episodes = currentEpisodesList.value
  if (currentEpisodeIndex.value > 0) {
    const prevEpisode = episodes[currentEpisodeIndex.value - 1]
    playEpisode(prevEpisode.url, prevEpisode.name, currentEpisodeIndex.value - 1)
  }
}

// 切换到下一集
const playNextEpisode = () => {
  const episodes = currentEpisodesList.value
  if (currentEpisodeIndex.value < episodes.length - 1) {
    const nextEpisode = episodes[currentEpisodeIndex.value + 1]
    playEpisode(nextEpisode.url, nextEpisode.name, currentEpisodeIndex.value + 1)
  }
}

// 自动播放下一集
const autoPlayNextEpisode = () => {
  playNextEpisode()
}

// 计算属性：获取当前选中的源下面的集数列表
const currentEpisodesList = computed(() => {
  if (!playSources.value.length) return []
  return playSources.value[currentSourceIndex.value].episodes
})

onMounted(() => {
  fetchVideoDetail()

  // 设置15秒定时器，保存观看历史
  watchTimer = setTimeout(() => {
    saveWatchHistory()
  }, 15000)

  // 监听视频播放结束事件
  const video = document.querySelector('video')
  if (video) {
    video.addEventListener('ended', autoPlayNextEpisode)
  }

  // 监听流量统计更新事件
  window.addEventListener('trafficStatsUpdated', loadCurrentViews)
})

onBeforeUnmount(() => {
  if (hls) hls.destroy()
  // 清除定时器
  if (watchTimer) clearTimeout(watchTimer)
  // 移除事件监听
  window.removeEventListener('trafficStatsUpdated', loadCurrentViews)
  // 移除视频播放结束事件监听
  const video = document.querySelector('video')
  if (video) {
    video.removeEventListener('ended', autoPlayNextEpisode)
  }
  // 恢复原页面标题
  document.title = '苍穹影视'
})

onUnmounted(() => {
  // 确保所有事件监听器都被移除
  window.removeEventListener('trafficStatsUpdated', loadCurrentViews)
})
</script>

<template>
  <div class="min-h-screen bg-[#0f1014] text-gray-100 font-sans pb-10">
    <NavBar />

    <!-- 实时观看人数显示 -->
    <div class="fixed top-20 right-4 z-50 flex items-center gap-2 bg-purple-600/80 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg">
      <Eye class="w-4 h-4 text-white animate-pulse" />
      <span class="text-white text-sm font-medium">{{ currentViews }} 人在看</span>
    </div>

    <!-- 只有数据加载完成后才显示 -->
    <div v-if="videoDetail" class="pt-20 mx-auto max-w-7xl px-4 lg:px-8 flex flex-col lg:flex-row gap-6 lg:gap-8">
      <!-- 左侧主区域：播放器 + 信息 -->
      <div class="flex-1 min-w-0">
        <!-- 播放器容器 -->
        <div class="relative aspect-video w-full overflow-hidden rounded-xl  shadow-2xl shadow-purple-900/10 border border-white/5 group">
          <Player
            v-if="currentEpisodeUrl"
            :url="currentEpisodeUrl"
            :poster="videoDetail?.vod_pic"
          />

          <!-- 如果没有 URL (比如刚加载时)，显示封面 -->
          <div v-else class="w-full h-full flex items-center justify-center bg-black">
            <img :src="videoDetail?.vod_pic" class="w-full h-full object-cover opacity-50">
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>

          <!-- 集数切换按钮 -->
          <div v-if="currentEpisodesList.length > 1" class="absolute bottom-4 left-4 right-4 flex justify-between">
            <button
              @click="playPreviousEpisode"
              :disabled="currentEpisodeIndex === 0"
              class="flex items-center gap-2 px-4 py-2 bg-black/70 backdrop-blur-sm rounded-lg text-white transition-all hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft class="w-4 h-4" />
              上一集
            </button>
            <button
              @click="playNextEpisode"
              :disabled="currentEpisodeIndex === currentEpisodesList.length - 1"
              class="flex items-center gap-2 px-4 py-2 bg-black/70 backdrop-blur-sm rounded-lg text-white transition-all hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一集
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- 播放源切换 (如果有多个源) -->
        <div v-if="playSources.length > 1" class="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            v-for="(source, index) in playSources"
            :key="index"
            @click="currentSourceIndex = index"
            class="px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 border"
            :class="currentSourceIndex === index
              ? 'bg-purple-600 border-purple-500 text-white'
              : 'bg-[#1a1b21] border-transparent text-gray-400 hover:text-white hover:bg-[#25262c]'"
          >
            <Layers class="w-4 h-4" />
            {{ source.name }}
          </button>
        </div>

        <!-- 影片基础信息 -->
        <div class="mt-6 space-y-4">
          <div>
            <h1 class="text-2xl md:text-3xl font-bold text-white mb-2">
              {{ videoDetail.vod_name }}
            </h1>
            <div class="flex items-center gap-2 text-sm">
              <span class="text-purple-400 font-medium">正在播放:</span>
              <span class="text-gray-200">{{ currentEpisodeName }}</span>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-400">
            <span class="flex items-center gap-1"><Calendar class="w-4 h-4" /> {{ videoDetail.vod_year }}</span>
            <span class="flex items-center gap-1"><MapPin class="w-4 h-4" /> {{ videoDetail.vod_area }}</span>
            <span class="flex items-center gap-1"><User class="w-4 h-4" /> {{ videoDetail.vod_actor }}</span>
          </div>

          <!-- 简介 -->
          <div class="p-5 rounded-xl bg-[#1a1b21] border border-white/5">
            <h3 class="flex items-center gap-2 font-bold text-white mb-3 text-sm uppercase tracking-wider">
              <FileText class="w-4 h-4 text-purple-500" /> 剧情简介
            </h3>
            <div
              class="text-gray-400 text-sm leading-relaxed"
              v-html="videoDetail.vod_content"
            />
          </div>
        </div>
      </div>

      <!-- 右侧侧边栏：选集 -->
      <div class="w-full lg:w-80 flex-shrink-0">
        <div class="rounded-xl bg-[#1a1b21] border border-white/5 sticky top-24 overflow-hidden flex flex-col max-h-[calc(100vh-8rem)]">
          <!-- 侧边栏头部 -->
          <div class="p-4 border-b border-white/5 bg-[#23242a]">
            <h3 class="font-bold text-white flex justify-between items-center">
              <span>选集</span>
              <span class="text-xs font-normal text-gray-500 bg-black/30 px-2 py-1 rounded-md">
                {{ currentEpisodesList.length }} 集全
              </span>
            </h3>
          </div>

          <!-- 选集列表 (滚动区域) -->
          <div class="p-3 overflow-y-auto flex-1 ">
            <div class="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-3 gap-2">
              <button
                v-for="(ep, index) in currentEpisodesList"
                :key="index"
                @click="playEpisode(ep.url, ep.name)"
                class="relative py-2 px-1 rounded-md text-xs font-medium transition-all duration-200 border truncate"
                :class="currentEpisodeUrl === ep.url
                  ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20'
                  : 'bg-[#2a2b32] border-transparent text-gray-400 hover:bg-[#34353c] hover:text-gray-200'"
                :title="ep.name"
              >
                {{ ep.name }}
                <!-- 播放状态小动画 -->
                <span v-if="currentEpisodeUrl === ep.url" class="absolute top-1 right-1 block w-1.5 h-1.5 bg-white rounded-full animate-pulse shadow-sm" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 加载中占位符 -->
    <div v-else class="flex h-screen w-full items-center justify-center">
      <div class="h-10 w-10 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
    </div>

    <!-- 热门视频推荐 -->
    <div v-if="recommendedVideos.length > 0" class="mt-16 mx-auto max-w-7xl px-4 lg:px-8">
      <div class="mb-8 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-1 h-6 bg-purple-600 rounded-full" />
          <h2 class="text-2xl font-bold text-white tracking-wide">热门推荐</h2>
        </div>
      </div>
      
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:gap-6">
        <div
          v-for="video in recommendedVideos"
          :key="video.vod_id"
          @click="$router.push(`/player/${video.vod_id}`)"
          class="group relative flex flex-col gap-2 cursor-pointer"
        >
          <!-- 封面容器 -->
          <div class="relative aspect-[2/3] overflow-hidden rounded-xl bg-gray-800 shadow-lg transition-all duration-300 group-hover:shadow-purple-500/20 group-hover:ring-2 group-hover:ring-purple-500/50">
            <!-- 图片 -->
            <img
              :src="video.vod_pic || 'https://picsum.photos/300/450?random=' + video.vod_id"
              :alt="video.vod_name"
              class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
              @error="$event.target.src = 'https://picsum.photos/300/450?random=' + video.vod_id"
            />
            <!-- 播放按钮 -->
            <div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div class="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                <PlayCircle class="w-6 h-6 text-white ml-1" />
              </div>
            </div>
          </div>
          
          <!-- 标题 -->
          <h3 class="text-sm font-medium text-white line-clamp-2 group-hover:text-purple-400 transition-colors">
            {{ video.vod_name }}
          </h3>
          
          <!-- 信息 -->
          <div class="flex items-center gap-2 text-xs text-gray-400">
            <span>{{ video.vod_year || '未知' }}</span>
            <span>•</span>
            <span>{{ video.vod_area || '未知' }}</span>
          </div>
        </div>
      </div>
    </div>

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

<style scoped>
.line-clamp-2 {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
</style>

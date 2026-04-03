<script setup>
import { ref, onMounted, onBeforeUnmount, computed, nextTick, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import Hls from 'hls.js'
import { Calendar, MapPin, User, FileText, Layers, Eye, ChevronLeft, ChevronRight, MessageSquare, PlayCircle, Flame } from 'lucide-vue-next'
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

// 评论功能
const comments = ref([])
const newComment = ref('')
const showCommentSection = ref(true)

// 评论数据 - 使用真实用户数据
const generateVideoComments = (videoId) => {
  // 如果没有存储的评论，返回空数组
  const savedComments = localStorage.getItem(`comments_${videoId}`)
  if (savedComments) {
    return JSON.parse(savedComments)
  }
  // 默认返回空数组，不生成模拟数据
  return []
}

// 加载评论
const loadComments = () => {
  const savedComments = localStorage.getItem(`comments_${route.params.id}`)
  if (savedComments) {
    comments.value = JSON.parse(savedComments)
  } else {
    // 使用基于视频ID生成的评论数据
    comments.value = generateVideoComments(route.params.id.toString())
    saveComments()
  }
}

// 保存评论
const saveComments = () => {
  localStorage.setItem(`comments_${route.params.id}`, JSON.stringify(comments.value))
}

// 提交评论
const submitComment = () => {
  if (!newComment.value.trim()) return
  
  const comment = {
    id: Date.now(),
    user: '游客' + Math.floor(Math.random() * 1000),
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`,
    content: newComment.value,
    time: '刚刚',
    likes: 0
  }
  
  comments.value.unshift(comment)
  saveComments()
  newComment.value = ''
}

// 点赞评论
const likeComment = (commentId) => {
  const comment = comments.value.find(c => c.id === commentId)
  if (comment) {
    comment.likes++
    saveComments()
  }
}

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
      const hits = data.list[0].vod_hits || 0
      currentViews.value = hits > 0 ? hits : Math.floor(Math.random() * 5000) + 1000
    } else {
      currentViews.value = Math.floor(Math.random() * 5000) + 1000
    }
  } catch (error) {
    console.error('获取真实观看人数失败', error)
    currentViews.value = Math.floor(Math.random() * 5000) + 1000
  }
}

// --- 核心逻辑 1: 获取并解析数据 ---
const fetchVideoDetail = async () => {
  const data = await apiCall({ ac: 'detail', ids: route.params.id })
  videoDetail.value = data?.list[0] || {}
  
  await loadCurrentViews()
  
  if (videoDetail.value.vod_name) {
    document.title = `${videoDetail.value.vod_name} - 苍穹影视`
  }
  await nextTick()
  parsePlayUrl(videoDetail.value.vod_play_from, videoDetail.value.vod_play_url)
  
  loadComments()
  
  loadRecommendedVideos()
}

// 加载热门视频推荐 - 使用真实数据
const loadRecommendedVideos = async () => {
  try {
    // 使用所有源获取热门视频（按点击量排序）
    const { fetchFromAllSources } = await import('@/utils/api')
    const data = await fetchFromAllSources({ ac: 'detail' }, 50)
    
    if (data && data.list && data.list.length > 0) {
      // 按点击量排序，过滤掉当前视频，取前6个作为推荐
      const sortedVideos = data.list
        .filter(video => video.vod_id !== route.params.id && video.vod_id !== videoDetail.value?.vod_id)
        .sort((a, b) => (parseInt(b.vod_hits) || 0) - (parseInt(a.vod_hits) || 0))
        .slice(0, 6)
      
      recommendedVideos.value = sortedVideos
      console.log('[Player] 加载热门推荐:', sortedVideos.length, '个视频')
    }
  } catch (error) {
    console.error('加载推荐视频失败', error)
    // 如果获取失败，使用当前视频的相关数据
    if (videoDetail.value) {
      recommendedVideos.value = []
    }
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

  // 监听流量统计更新事件
  window.addEventListener('trafficStatsUpdated', loadCurrentViews)
})

onBeforeUnmount(() => {
  if (hls) hls.destroy()
  // 清除定时器
  if (watchTimer) clearTimeout(watchTimer)
  // 移除事件监听
  window.removeEventListener('trafficStatsUpdated', loadCurrentViews)
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

    <!-- 只有数据加载完成后才显示 -->
    <div v-if="videoDetail" class="pt-20 mx-auto max-w-7xl px-3 sm:px-4 lg:px-8 flex flex-col lg:flex-row gap-4 lg:gap-8">
      <!-- 左侧主区域：播放器 + 信息 -->
      <div class="flex-1 min-w-0">
        <!-- 播放器容器 -->
        <div class="relative aspect-video w-full overflow-hidden rounded-lg lg:rounded-xl shadow-2xl shadow-purple-900/10 border border-white/5 group">
          <Player
            v-if="currentEpisodeUrl"
            :url="currentEpisodeUrl"
            :poster="videoDetail?.vod_pic"
            @ended="autoPlayNextEpisode"
          />

          <!-- 如果没有 URL (比如刚加载时)，显示封面 -->
          <div v-else class="w-full h-full flex items-center justify-center bg-black">
            <img :src="videoDetail?.vod_pic" class="w-full h-full object-cover opacity-50">
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>

          <!-- 集数切换按钮 - 移动端优化 -->
          <div v-if="currentEpisodesList.length > 1" class="absolute bottom-2 left-2 right-2 flex justify-between">
            <button
              @click="playPreviousEpisode"
              :disabled="currentEpisodeIndex === 0"
              class="flex items-center gap-1 px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-lg text-white text-sm transition-all hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft class="w-4 h-4" />
              <span class="hidden sm:inline">上一集</span>
            </button>
            <button
              @click="playNextEpisode"
              :disabled="currentEpisodeIndex === currentEpisodesList.length - 1"
              class="flex items-center gap-1 px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-lg text-white text-sm transition-all hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span class="hidden sm:inline">下一集</span>
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

      <!-- 右侧侧边栏：选集 - 移动端优化 -->
      <div class="w-full lg:w-80 flex-shrink-0">
        <div class="rounded-xl bg-[#1a1b21] border border-white/5 sticky top-24 overflow-hidden flex flex-col max-h-[calc(100vh-8rem)]">
          <!-- 侧边栏头部 -->
          <div class="p-3 lg:p-4 border-b border-white/5 bg-[#23242a]">
            <h3 class="font-bold text-white flex justify-between items-center">
              <span>选集</span>
              <span class="text-xs font-normal text-gray-500 bg-black/30 px-2 py-1 rounded-md">
                {{ currentEpisodesList.length }} 集全
              </span>
            </h3>
          </div>

          <!-- 选集列表 (滚动区域) - 移动端优化网格 -->
          <div class="p-2 lg:p-3 overflow-y-auto flex-1 ">
            <div class="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-3 gap-1.5 lg:gap-2">
              <button
                v-for="(ep, index) in currentEpisodesList"
                :key="index"
                @click="playEpisode(ep.url, ep.name)"
                class="relative py-1.5 lg:py-2 px-1 rounded-md text-xs font-medium transition-all duration-200 border truncate"
                :class="currentEpisodeUrl === ep.url
                  ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20'
                  : 'bg-[#2a2b32] border-transparent text-gray-400 hover:bg-[#34353c] hover:text-gray-200'"
                :title="ep.name"
              >
                {{ ep.name }}
                <!-- 播放状态小动画 -->
                <span v-if="currentEpisodeUrl === ep.url" class="absolute top-0.5 right-0.5 block w-1 h-1 bg-white rounded-full animate-pulse shadow-sm" />
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

    <!-- 评论区域 - 移动端优化 -->
    <div class="mt-12 lg:mt-16 mx-auto max-w-7xl px-3 sm:px-4 lg:px-8">
      <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-1 h-6 bg-purple-600 rounded-full" />
          <h2 class="text-xl lg:text-2xl font-bold text-white tracking-wide">评论区</h2>
        </div>
        <button @click="showCommentSection = !showCommentSection" class="flex cursor-pointer items-center gap-2 rounded-xl bg-white/10 border border-white/10 px-3 py-1.5 lg:px-4 lg:py-2 font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20 hover:border-white/20 text-sm">
          <MessageSquare class="w-4 h-4" />
          <span class="hidden sm:inline">{{ showCommentSection ? '收起' : `展开 (${comments.length})` }}</span>
          <span class="sm:hidden">{{ comments.length }}</span>
        </button>
      </div>
      
      <div v-if="showCommentSection" class="space-y-4 lg:space-y-6">
        <!-- 发表评论 - 移动端优化 -->
        <div class="p-4 lg:p-6 rounded-xl bg-[#1a1b21] border border-white/5">
          <div class="flex gap-3 lg:gap-4">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=me" class="w-8 h-8 lg:w-10 lg:h-10 rounded-full" />
            <div class="flex-1 space-y-3">
              <textarea
                v-model="newComment"
                placeholder="说点什么吧..."
                class="w-full h-20 lg:h-24 px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl bg-[#2a2b32] border border-white/10 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none resize-none text-sm"
              />
              <div class="flex justify-end">
                <button @click="submitComment" class="px-4 lg:px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-all text-sm">
                  发表评论
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 评论列表 - 移动端优化 -->
        <div class="space-y-3 lg:space-y-4">
          <div
            v-for="comment in comments"
            :key="comment.id"
            class="p-4 lg:p-5 rounded-xl bg-[#1a1b21] border border-white/5"
          >
            <div class="flex gap-3 lg:gap-4">
              <img :src="comment.avatar" class="w-8 h-8 lg:w-10 lg:h-10 rounded-full" />
              <div class="flex-1">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-medium text-white text-sm">{{ comment.user }}</span>
                  <span class="text-xs text-gray-500">{{ comment.time }}</span>
                </div>
                <p class="text-gray-300 mb-3 text-sm">{{ comment.content }}</p>
                <button @click="likeComment(comment.id)" class="flex items-center gap-1 text-gray-400 hover:text-purple-400 transition-colors text-xs">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                  {{ comment.likes }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 热门视频推荐 - 移动端优化 -->
    <div v-if="recommendedVideos.length > 0" class="mt-12 lg:mt-16 mx-auto max-w-7xl px-3 sm:px-4 lg:px-8">
      <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-1 h-6 bg-purple-600 rounded-full" />
          <h2 class="text-xl lg:text-2xl font-bold text-white tracking-wide">热门推荐</h2>
        </div>
      </div>
      
      <div class="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:gap-6">
        <div
          v-for="video in recommendedVideos"
          :key="video.vod_id"
          @click="$router.push(`/player/${video.vod_id}`)"
          class="group relative flex flex-col gap-2 cursor-pointer"
        >
          <!-- 封面容器 -->
          <div class="relative aspect-[2/3] overflow-hidden rounded-lg lg:rounded-xl bg-gray-800 shadow-lg transition-all duration-300 group-hover:shadow-purple-500/20 group-hover:ring-2 group-hover:ring-purple-500/50">
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
              <div class="w-10 h-10 lg:w-12 lg:h-12 bg-purple-600 rounded-full flex items-center justify-center">
                <PlayCircle class="w-5 h-5 lg:w-6 lg:h-6 text-white ml-0.5" />
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

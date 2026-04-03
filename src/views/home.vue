<script setup>
import { onMounted, ref, onUnmounted, computed } from 'vue'
import NavBar from '@/components/NavBar.vue'
import VideoCard from '@/components/VideoCard.vue'
import { 
  PlayCircle, Calendar, MapPin, Layers, Eye, Star, TrendingUp, 
  Flame, Clock, Zap, ChevronLeft, ChevronRight, Database, Film, Tv, Sparkles
} from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { apiCall, videoSources, setCurrentSource, initSourceSetting, fetchFromAllSources } from '@/utils/api'

const router = useRouter()

// 视频数据
const allVideos = ref([])
const hotVideoList = ref([])
const newVideoList = ref([])
const movieList = ref([])
const tvList = ref([])
const animeList = ref([])
const varietyList = ref([])
const carouselVideos = ref([])
const currentCarouselIndex = ref(0)

// 状态
const isLoading = ref(false)
const currentSourceIndex = ref(0)
const useAllSources = ref(true) // 默认使用所有源
const liveViewers = ref(0)

// 初始化
const initSettings = () => {
  initSourceSetting()
  const savedIndex = localStorage.getItem('currentVideoSource')
  if (savedIndex !== null) {
    currentSourceIndex.value = parseInt(savedIndex)
  }
  
  const savedUseAll = localStorage.getItem('useAllSources')
  if (savedUseAll !== null) {
    useAllSources.value = savedUseAll === 'true'
  }
}

// 加载所有视频数据
const loadVideoData = async () => {
  isLoading.value = true
  try {
    let data
    if (useAllSources.value) {
      // 从所有源获取并整合数据
      data = await fetchFromAllSources({ ac: 'detail' }, 100)
    } else {
      // 从当前选中的源获取
      setCurrentSource(currentSourceIndex.value)
      data = await apiCall({ ac: 'detail' })
    }

    if (data.list && data.list.length > 0) {
      allVideos.value = data.list
      
      // 按点击量排序 - 热门推荐
      const sortedByHits = [...data.list].sort((a, b) => (b.vod_hits || 0) - (a.vod_hits || 0))
      hotVideoList.value = sortedByHits.slice(0, 10)
      
      // 按时间排序 - 最新更新
      const sortedByTime = [...data.list].sort((a, b) => {
        const timeA = new Date(b.vod_time || 0).getTime()
        const timeB = new Date(a.vod_time || 0).getTime()
        return timeA - timeB
      })
      newVideoList.value = sortedByTime.slice(0, 10)
      
      // 轮播展示最新的10个视频
      carouselVideos.value = sortedByTime.slice(0, 10)
      
      // 分类数据 - 改进分类匹配逻辑
      // 电影：type_id 1-6 通常表示电影相关，或名称包含"电影"
      movieList.value = data.list.filter(v => {
        const typeName = (v.vod_type_name || v.type_name || '').toLowerCase()
        const typeId = parseInt(v.vod_type || v.type_id) || 0
        // 电影分类：type_id 1-6 或名称包含"电影"
        return typeName.includes('电影') || (typeId >= 1 && typeId <= 6)
      }).slice(0, 10)
      
      // 电视剧：type_id 7-15 通常表示电视剧，或名称包含"电视剧""剧集""国产剧""美剧""韩剧"等
      tvList.value = data.list.filter(v => {
        const typeName = (v.vod_type_name || v.type_name || '').toLowerCase()
        const typeId = parseInt(v.vod_type || v.type_id) || 0
        return typeName.includes('电视剧') || typeName.includes('剧集') || 
               typeName.includes('国产剧') || typeName.includes('美剧') || 
               typeName.includes('韩剧') || typeName.includes('日剧') || 
               typeName.includes('泰剧') || typeName.includes('港剧') || 
               typeName.includes('台剧') || (typeId >= 7 && typeId <= 15)
      }).slice(0, 10)
      
      // 动漫：type_id 16-25 通常表示动漫，或名称包含"动漫""动画""番剧"等
      animeList.value = data.list.filter(v => {
        const typeName = (v.vod_type_name || v.type_name || '').toLowerCase()
        const typeId = parseInt(v.vod_type || v.type_id) || 0
        return typeName.includes('动漫') || typeName.includes('动画') || 
               typeName.includes('番剧') || typeName.includes('日本动漫') || 
               typeName.includes('国产动漫') || typeName.includes('欧美动漫') || 
               (typeId >= 16 && typeId <= 25)
      }).slice(0, 10)
      
      // 综艺：type_id 26-35 通常表示综艺，或名称包含"综艺""娱乐"等
      varietyList.value = data.list.filter(v => {
        const typeName = (v.vod_type_name || v.type_name || '').toLowerCase()
        const typeId = parseInt(v.vod_type || v.type_id) || 0
        return typeName.includes('综艺') || typeName.includes('娱乐') || 
               typeName.includes('真人秀') || typeName.includes('脱口秀') || 
               (typeId >= 26 && typeId <= 35)
      }).slice(0, 10)
      
      // 如果分类数据不足，用热门数据补充（但确保不重复）
      const usedIds = new Set()
      movieList.value.forEach(v => usedIds.add(v.vod_id))
      tvList.value.forEach(v => usedIds.add(v.vod_id))
      animeList.value.forEach(v => usedIds.add(v.vod_id))
      varietyList.value.forEach(v => usedIds.add(v.vod_id))
      
      if (movieList.value.length < 5) {
        const additional = sortedByHits.filter(v => !usedIds.has(v.vod_id)).slice(0, 10 - movieList.value.length)
        additional.forEach(v => usedIds.add(v.vod_id))
        movieList.value = [...movieList.value, ...additional]
      }
      if (tvList.value.length < 5) {
        const additional = sortedByHits.filter(v => !usedIds.has(v.vod_id)).slice(0, 10 - tvList.value.length)
        additional.forEach(v => usedIds.add(v.vod_id))
        tvList.value = [...tvList.value, ...additional]
      }
      if (animeList.value.length < 5) {
        const additional = sortedByHits.filter(v => !usedIds.has(v.vod_id)).slice(0, 10 - animeList.value.length)
        additional.forEach(v => usedIds.add(v.vod_id))
        animeList.value = [...animeList.value, ...additional]
      }
      if (varietyList.value.length < 5) {
        const additional = sortedByHits.filter(v => !usedIds.has(v.vod_id)).slice(0, 10 - varietyList.value.length)
        varietyList.value = [...varietyList.value, ...additional]
      }
    }
  } catch (error) {
    console.error('加载视频数据失败:', error)
  } finally {
    isLoading.value = false
  }
}

// 切换视频源
const switchVideoSource = (index) => {
  currentSourceIndex.value = index
  useAllSources.value = false
  localStorage.setItem('useAllSources', 'false')
  setCurrentSource(index)
  loadVideoData()
}

// 使用所有源
const useAllVideoSources = () => {
  useAllSources.value = true
  localStorage.setItem('useAllSources', 'true')
  loadVideoData()
}

// 轮播控制
const nextCarousel = () => {
  if (carouselVideos.value.length > 0) {
    currentCarouselIndex.value = (currentCarouselIndex.value + 1) % carouselVideos.value.length
  }
}

const prevCarousel = () => {
  if (carouselVideos.value.length > 0) {
    currentCarouselIndex.value = (currentCarouselIndex.value - 1 + carouselVideos.value.length) % carouselVideos.value.length
  }
}

// 实时在线人数
const loadLiveViewers = () => {
  const saved = localStorage.getItem('liveViewers')
  if (saved) {
    liveViewers.value = parseInt(saved)
  } else {
    liveViewers.value = Math.floor(Math.random() * 2000) + 1000
    localStorage.setItem('liveViewers', liveViewers.value.toString())
  }
}

const updateLiveViewers = () => {
  const change = Math.floor(Math.random() * 10) - 5
  liveViewers.value = Math.max(500, liveViewers.value + change)
  localStorage.setItem('liveViewers', liveViewers.value.toString())
}

// 工具函数
const stripHtml = (html) => {
  if (!html) return ''
  return html.replace(/<[^>]*>?/gm, '')
}

const goToDetail = (id) => {
  router.push(`/player/${id}`)
}

const goDetail = () => {
  router.push('/category/1')
}

// 当前轮播视频
const currentCarouselVideo = computed(() => {
  return carouselVideos.value[currentCarouselIndex.value] || null
})

// 自动轮播
let carouselInterval = null
let viewersInterval = null

onMounted(() => {
  initSettings()
  loadLiveViewers()
  loadVideoData()
  
  // 自动轮播
  carouselInterval = setInterval(nextCarousel, 5000)
  
  // 更新在线人数
  viewersInterval = setInterval(updateLiveViewers, 30000)
})

onUnmounted(() => {
  if (carouselInterval) clearInterval(carouselInterval)
  if (viewersInterval) clearInterval(viewersInterval)
})
</script>

<template>
  <div class="min-h-screen pb-20 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
    <!-- 背景装饰 -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div class="absolute top-0 left-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl animate-pulse" style="animation-duration: 8s;" />
      <div class="absolute top-1/3 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl animate-pulse" style="animation-duration: 10s; animation-delay: 2s;" />
      <div class="absolute bottom-1/4 left-1/3 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl animate-pulse" style="animation-duration: 12s; animation-delay: 4s;" />
    </div>
    
    <NavBar />

    <!-- 在线人数 -->
    <div class="fixed top-20 right-4 z-50 flex items-center gap-2 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500/90 backdrop-blur-md px-4 py-2.5 rounded-full shadow-2xl shadow-red-500/30 border border-white/10">
      <Flame class="w-4.5 h-4.5 text-white animate-pulse" />
      <span class="text-white text-sm font-black">{{ liveViewers }} 人在线</span>
    </div>

    <!-- 轮播区域 -->
    <header v-if="currentCarouselVideo" class="relative w-full overflow-hidden min-h-[70vh] md:min-h-[80vh] flex items-center pt-20">
      <div class="absolute inset-0 z-0">
        <img :src="currentCarouselVideo.vod_pic" class="h-full w-full object-cover opacity-25 blur-3xl scale-125">
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
        <div class="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/40 to-transparent" />
      </div>

      <div class="relative z-10 mx-auto flex w-full max-w-7xl flex-col md:flex-row items-center gap-10 px-4 py-12 sm:px-6 lg:px-8">
        <div class="flex-1 space-y-6 text-center md:text-left w-full">
          <div class="flex flex-wrap items-center justify-center md:justify-start gap-3">
            <span class="px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 shadow-[0_0_20px_rgba(249,115,22,0.5)] text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <Flame class="w-3.5 h-3.5 fill-yellow-300" />
              最新上线
            </span>
            <span class="flex items-center gap-1.5 text-xs font-semibold text-gray-200 bg-black/60 border border-white/15 px-3 py-1.5 rounded-full backdrop-blur-xl">
              <Calendar class="w-3.5 h-3.5" /> {{ currentCarouselVideo.vod_year || '2025' }}
            </span>
            <span class="flex items-center gap-1.5 text-xs font-semibold text-gray-200 bg-black/60 border border-white/15 px-3 py-1.5 rounded-full backdrop-blur-xl">
              <MapPin class="w-3.5 h-3.5" /> {{ currentCarouselVideo.vod_area || '未知' }}
            </span>
          </div>

          <h1 class="text-4xl md:text-5xl lg:text-7xl font-black text-white leading-tight">
            <span class="bg-gradient-to-r from-white via-orange-200 to-pink-200 bg-clip-text text-transparent">
              {{ currentCarouselVideo.vod_name }}
            </span>
          </h1>

          <p class="mx-auto md:mx-0 max-w-xl text-base md:text-lg text-gray-300 line-clamp-2 md:line-clamp-3 leading-relaxed">
            {{ stripHtml(currentCarouselVideo.vod_blurb || currentCarouselVideo.vod_content) }}
          </p>

          <div class="flex items-center justify-center md:justify-start gap-4 pt-4">
            <button @click="goToDetail(currentCarouselVideo.vod_id)" class="cursor-pointer group flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 px-8 py-4 font-black text-white transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(249,115,22,0.6)] active:scale-95">
              <PlayCircle class="h-6 w-6 fill-current transition-transform group-hover:rotate-12" />
              立即观看
            </button>
          </div>

          <!-- 轮播指示器 -->
          <div class="flex items-center justify-center md:justify-start gap-2 pt-4">
            <button v-for="(video, index) in carouselVideos.slice(0, 5)" :key="video.vod_id" @click="currentCarouselIndex = index" class="h-2 rounded-full transition-all duration-300" :class="currentCarouselIndex === index ? 'w-8 bg-gradient-to-r from-orange-500 to-pink-500' : 'w-2 bg-white/30 hover:bg-white/50'" />
          </div>
        </div>

        <!-- 轮播图片 -->
        <div class="hidden md:block w-[280px] lg:w-[350px] flex-shrink-0 relative group">
          <div class="absolute -inset-2 bg-gradient-to-tr from-orange-500 via-red-500 to-pink-500 rounded-[2rem] blur-2xl opacity-40 group-hover:opacity-70 transition duration-700" />
          <img :src="currentCarouselVideo.vod_pic" class="relative w-full rounded-[1.5rem] shadow-[0_20px_40px_rgba(0,0,0,0.6)] border-2 border-white/10 transform transition duration-700 group-hover:-translate-y-4 group-hover:rotate-1 object-cover aspect-[2/3]">
          <button @click="prevCarousel" class="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-all">
            <ChevronLeft class="w-5 h-5" />
          </button>
          <button @click="nextCarousel" class="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-all">
            <ChevronRight class="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>

    <header v-else class="h-[70vh] w-full flex items-center justify-center bg-slate-950 pt-20">
      <div v-if="isLoading" class="animate-pulse flex flex-col items-center gap-5">
        <div class="h-12 w-80 bg-white/5 rounded-2xl" />
        <div class="h-6 w-64 bg-white/5 rounded-xl" />
      </div>
      <div v-else class="text-gray-400">暂无数据</div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 relative z-20 space-y-20">
      <!-- 视频源选择 -->
      <section class="relative">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-4">
            <div class="w-2 h-10 bg-gradient-to-b from-orange-500 to-red-500 rounded-full shadow-lg shadow-orange-500/50" />
            <div class="flex items-center gap-3">
              <Database class="w-7 h-7 text-orange-500" />
              <h2 class="text-3xl font-black text-white tracking-wide">视频源选择</h2>
            </div>
          </div>
        </div>
        
        <div class="flex flex-wrap gap-3">
          <button @click="useAllVideoSources" class="px-6 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 border-2" :class="useAllSources ? 'bg-gradient-to-r from-orange-500 to-red-500 border-orange-400 text-white shadow-lg shadow-orange-500/40' : 'bg-[#1a1b23] border-transparent text-gray-400 hover:text-white hover:bg-[#252730] hover:border-white/10'">
            <Layers class="w-4.5 h-4.5" />
            全部源
          </button>
          <button v-for="(source, index) in videoSources" :key="index" @click="switchVideoSource(index)" class="px-6 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 border-2" :class="!useAllSources && currentSourceIndex === index ? 'bg-gradient-to-r from-orange-500 to-red-500 border-orange-400 text-white shadow-lg shadow-orange-500/40' : 'bg-[#1a1b23] border-transparent text-gray-400 hover:text-white hover:bg-[#252730] hover:border-white/10'">
            <Database class="w-4.5 h-4.5" />
            {{ source.name }}
          </button>
        </div>
      </section>

      <!-- 热门推荐 -->
      <section v-if="hotVideoList.length > 0">
        <div class="mb-8 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-2 h-10 bg-gradient-to-b from-orange-500 to-red-500 rounded-full shadow-lg shadow-orange-500/50" />
            <div class="flex items-center gap-3">
              <Flame class="w-7 h-7 text-orange-500" />
              <h2 class="text-3xl font-black text-white tracking-wide">热门推荐</h2>
            </div>
          </div>
          <button @click="goDetail" class="hidden sm:flex cursor-pointer items-center gap-2.5 rounded-2xl bg-gradient-to-r from-white/10 to-white/5 border border-white/10 px-7 py-3 font-bold text-white backdrop-blur-xl transition-all hover:from-white/20 hover:to-white/10 hover:border-white/20">
            查看全部 <TrendingUp class="w-4.5 h-4.5" />
          </button>
        </div>
        <div class="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <VideoCard v-for="video in hotVideoList" :key="video.vod_id" :video="video" @click="goToDetail(video.vod_id)" />
        </div>
      </section>

      <!-- 最新更新 -->
      <section v-if="newVideoList.length > 0">
        <div class="mb-8 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-2 h-10 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full shadow-lg shadow-blue-500/50" />
            <div class="flex items-center gap-3">
              <Clock class="w-7 h-7 text-blue-500" />
              <h2 class="text-3xl font-black text-white tracking-wide">最新更新</h2>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <VideoCard v-for="video in newVideoList" :key="video.vod_id" :video="video" @click="goToDetail(video.vod_id)" />
        </div>
      </section>

      <!-- 电影 -->
      <section v-if="movieList.length > 0">
        <div class="mb-8 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-2 h-10 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full shadow-lg shadow-purple-500/50" />
            <div class="flex items-center gap-3">
              <Film class="w-7 h-7 text-purple-500" />
              <h2 class="text-3xl font-black text-white tracking-wide">电影</h2>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <VideoCard v-for="video in movieList" :key="video.vod_id" :video="video" @click="goToDetail(video.vod_id)" />
        </div>
      </section>

      <!-- 电视剧 -->
      <section v-if="tvList.length > 0">
        <div class="mb-8 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-2 h-10 bg-gradient-to-b from-green-500 to-emerald-500 rounded-full shadow-lg shadow-green-500/50" />
            <div class="flex items-center gap-3">
              <Tv class="w-7 h-7 text-green-500" />
              <h2 class="text-3xl font-black text-white tracking-wide">电视剧</h2>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <VideoCard v-for="video in tvList" :key="video.vod_id" :video="video" @click="goToDetail(video.vod_id)" />
        </div>
      </section>

      <!-- 动漫 -->
      <section v-if="animeList.length > 0">
        <div class="mb-8 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-2 h-10 bg-gradient-to-b from-pink-500 to-rose-500 rounded-full shadow-lg shadow-pink-500/50" />
            <div class="flex items-center gap-3">
              <Sparkles class="w-7 h-7 text-pink-500" />
              <h2 class="text-3xl font-black text-white tracking-wide">动漫</h2>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <VideoCard v-for="video in animeList" :key="video.vod_id" :video="video" @click="goToDetail(video.vod_id)" />
        </div>
      </section>

      <!-- 综艺 -->
      <section v-if="varietyList.length > 0">
        <div class="mb-8 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-2 h-10 bg-gradient-to-b from-yellow-500 to-orange-500 rounded-full shadow-lg shadow-yellow-500/50" />
            <div class="flex items-center gap-3">
              <Layers class="w-7 h-7 text-yellow-500" />
              <h2 class="text-3xl font-black text-white tracking-wide">综艺</h2>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <VideoCard v-for="video in varietyList" :key="video.vod_id" :video="video" @click="goToDetail(video.vod_id)" />
        </div>
      </section>
    </main>
  </div>
</template>

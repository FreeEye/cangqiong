<script setup>
import { onMounted, ref, onUnmounted, computed } from 'vue'
import NavBar from '@/components/NavBar.vue'
import VideoCard from '@/components/VideoCard.vue'
import { PlayCircle, Calendar, MapPin, Layers, Eye, Star, TrendingUp, Flame, Clock, Zap, ChevronLeft, ChevronRight, Database } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { apiCall } from '@/utils/api'

const featuredVideo = ref(null)
const videoList = ref([])
const hotVideoList = ref([])
const newVideoList = ref([])
const animeVideoList = ref([])
const varietyVideoList = ref([])
const carouselVideos = ref([])
const currentCarouselIndex = ref(0)

const liveViewers = ref(0)

// 视频源列表
const videoSources = [
  { name: '如意资源', url: 'https://cj.rycjapi.com/api.php/provide/vod/', isAvailable: true },
  { name: '极速资源', url: 'https://jszyapi.com/api.php/provide/vod/', isAvailable: true },
  { name: '非凡影视', url: 'http://ffzy5.tv/api.php/provide/vod/', isAvailable: true },
  { name: '卧龙资源', url: 'https://wolongzyw.com/api.php/provide/vod/', isAvailable: true },
  { name: '最大资源', url: 'https://api.zuidapi.com/api.php/provide/vod/', isAvailable: true },
  { name: '无尽资源', url: 'https://api.wujinapi.me/api.php/provide/vod/', isAvailable: true }
]
const currentSourceIndex = ref(0)
const showSourceSelector = ref(false)

const router = useRouter()

const goToDetail = (id) => {
  router.push(`/player/${id}`)
}

const stripHtml = (html) => {
  if (!html) return ''
  return html.replace(/<[^>]*>?/gm, '')
}

const loadLiveViewers = () => {
  const savedViewers = localStorage.getItem('liveViewers')
  if (savedViewers) {
    liveViewers.value = parseInt(savedViewers)
  } else {
    liveViewers.value = Math.floor(Math.random() * 2000) + 1000
    localStorage.setItem('liveViewers', liveViewers.value.toString())
  }
}

const updateLiveViewers = () => {
  const change = Math.floor(Math.random() * 5) - 2
  liveViewers.value = Math.max(500, liveViewers.value + change)
  localStorage.setItem('liveViewers', liveViewers.value.toString())
}

// 轮播控制
const nextCarousel = () => {
  currentCarouselIndex.value = (currentCarouselIndex.value + 1) % carouselVideos.value.length
}

const prevCarousel = () => {
  currentCarouselIndex.value = (currentCarouselIndex.value - 1 + carouselVideos.value.length) % carouselVideos.value.length
}

// 切换视频源
const switchVideoSource = (index) => {
  currentSourceIndex.value = index
  showSourceSelector.value = false
  // 重新加载数据
  loadVideoData()
}

// 加载视频数据
const loadVideoData = async () => {
  try {
    const data = await apiCall({ ac: 'detail' })

    if (data.list && data.list.length > 0) {
      const sortedList = [...data.list].sort((a, b) => (b.vod_hits || 0) - (a.vod_hits || 0))
      videoList.value = sortedList
      hotVideoList.value = sortedList.slice(0, 10)
      newVideoList.value = [...data.list].sort((a, b) => new Date(b.vod_time) - new Date(a.vod_time)).slice(0, 10)
      
      // 轮播展示最新的10个视频
      carouselVideos.value = [...data.list].sort((a, b) => new Date(b.vod_time) - new Date(a.vod_time)).slice(0, 10)
      
      const animeList = data.list.filter(v => v.vod_type_name === '动漫' || v.vod_type === '3').slice(0, 10)
      const varietyList = data.list.filter(v => v.vod_type_name === '综艺' || v.vod_type === '4').slice(0, 10)
      
      animeVideoList.value = animeList.length > 0 ? animeList : sortedList.slice(5, 15)
      varietyVideoList.value = varietyList.length > 0 ? varietyList : sortedList.slice(10, 20)
      
      featuredVideo.value = sortedList[0]
    }
  } catch (error) {
    console.error('加载失败', error)
  }
}

onMounted(async () => {
  loadLiveViewers()
  
  const viewersInterval = setInterval(updateLiveViewers, 30000)
  
  // 轮播自动切换
  const carouselInterval = setInterval(nextCarousel, 5000)

  window.addEventListener('liveViewersUpdated', () => {
    const savedViewers = localStorage.getItem('liveViewers')
    if (savedViewers) {
      liveViewers.value = parseInt(savedViewers)
    }
  })

  await loadVideoData()
  
  onUnmounted(() => {
    clearInterval(viewersInterval)
    clearInterval(carouselInterval)
    window.removeEventListener('liveViewersUpdated', () => {})
  })
})

const goDetail = () => {
  router.push('/category/1')
}

// 当前轮播视频
const currentCarouselVideo = computed(() => {
  return carouselVideos.value[currentCarouselIndex.value] || null
})
</script>

<template>
  <div class="min-h-screen pb-20 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
    <div class="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div class="absolute top-0 left-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse" style="animation-duration: 8s;" />
      <div class="absolute top-1/3 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl animate-pulse" style="animation-duration: 10s; animation-delay: 2s;" />
      <div class="absolute bottom-1/4 left-1/3 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl animate-pulse" style="animation-duration: 12s; animation-delay: 4s;" />
    </div>
    
    <NavBar />

    <div class="fixed top-20 right-4 z-50 flex items-center gap-2 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500/90 backdrop-blur-md px-4 py-2.5 rounded-full shadow-2xl shadow-red-500/30 border border-white/10">
      <Flame class="w-4.5 h-4.5 text-white animate-pulse" />
      <span class="text-white text-sm font-black">{{ liveViewers }} 人在线</span>
    </div>

    <!-- 轮播展示最新视频 -->
    <header v-if="currentCarouselVideo" class="relative w-full overflow-hidden min-h-[70vh] md:min-h-[80vh] flex items-center pt-20">
      <div class="absolute inset-0 z-0">
        <img
          :src="currentCarouselVideo.vod_pic"
          class="h-full w-full object-cover opacity-25 blur-3xl scale-125"
        >
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
            <button
              @click="goToDetail(currentCarouselVideo.vod_id)"
              class="cursor-pointer group flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 px-8 py-4 font-black text-white transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(249,115,22,0.6)] active:scale-95"
            >
              <PlayCircle class="h-6 w-6 fill-current transition-transform group-hover:rotate-12" />
              立即观看
            </button>
          </div>

          <!-- 轮播指示器 -->
          <div class="flex items-center justify-center md:justify-start gap-2 pt-4">
            <button
              v-for="(video, index) in carouselVideos.slice(0, 5)"
              :key="video.vod_id"
              @click="currentCarouselIndex = index"
              class="w-2 h-2 rounded-full transition-all duration-300"
              :class="currentCarouselIndex === index ? 'w-8 bg-gradient-to-r from-orange-500 to-pink-500' : 'bg-white/30 hover:bg-white/50'"
            />
          </div>
        </div>

        <!-- 轮播图片 -->
        <div class="hidden md:block w-[280px] lg:w-[350px] flex-shrink-0 relative group">
          <div class="absolute -inset-2 bg-gradient-to-tr from-orange-500 via-red-500 to-pink-500 rounded-[2rem] blur-2xl opacity-40 group-hover:opacity-70 transition duration-700" />
          <img
            :src="currentCarouselVideo.vod_pic"
            class="relative w-full rounded-[1.5rem] shadow-[0_20px_40px_rgba(0,0,0,0.6)] border-2 border-white/10 transform transition duration-700 group-hover:-translate-y-4 group-hover:rotate-1 object-cover aspect-[2/3]"
            alt="Carousel Poster"
          >
          <!-- 轮播切换按钮 -->
          <button
            @click="prevCarousel"
            class="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-all"
          >
            <ChevronLeft class="w-5 h-5" />
          </button>
          <button
            @click="nextCarousel"
            class="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-all"
          >
            <ChevronRight class="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>

    <header v-else class="h-[70vh] w-full flex items-center justify-center bg-slate-950 pt-20">
      <div class="animate-pulse flex flex-col items-center gap-5">
        <div class="h-12 w-80 bg-white/5 rounded-2xl" />
        <div class="h-6 w-64 bg-white/5 rounded-xl" />
        <div class="h-4 w-56 bg-white/5 rounded-lg" />
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 relative z-20 space-y-20">
      <!-- 视频源切换 -->
      <section class="relative">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-4">
            <div class="w-2 h-10 bg-gradient-to-b from-orange-500 to-red-500 rounded-full shadow-lg shadow-orange-500/50" />
            <div class="flex items-center gap-3">
              <Database class="w-7 h-7 text-orange-500" />
              <h2 class="text-3xl font-black text-white tracking-wide">
                视频源选择
              </h2>
            </div>
          </div>
        </div>
        
        <div class="flex flex-wrap gap-3">
          <button
            v-for="(source, index) in videoSources"
            :key="index"
            @click="switchVideoSource(index)"
            class="px-6 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 border-2"
            :class="currentSourceIndex === index
              ? 'bg-gradient-to-r from-orange-500 to-red-500 border-orange-400 text-white shadow-lg shadow-orange-500/40'
              : 'bg-[#1a1b23] border-transparent text-gray-400 hover:text-white hover:bg-[#252730] hover:border-white/10'"
          >
            <Layers class="w-4.5 h-4.5" />
            {{ source.name }}
          </button>
        </div>
      </section>

      <section>
        <div class="mb-8 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-2 h-10 bg-gradient-to-b from-orange-500 to-red-500 rounded-full shadow-lg shadow-orange-500/50" />
            <div class="flex items-center gap-3">
              <Flame class="w-7 h-7 text-orange-500" />
              <h2 class="text-3xl font-black text-white tracking-wide">
                热门推荐
              </h2>
            </div>
          </div>
          <button @click="goDetail" class="hidden sm:flex cursor-pointer items-center gap-2.5 rounded-2xl bg-gradient-to-r from-white/10 to-white/5 border border-white/10 px-7 py-3 font-bold text-white backdrop-blur-xl transition-all hover:from-white/20 hover:to-white/10 hover:border-white/20">
            查看全部
            <TrendingUp class="w-4.5 h-4.5" />
          </button>
        </div>

        <div class="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <VideoCard
            v-for="video in hotVideoList"
            :key="video.vod_id"
            :video="video"
            @click="goToDetail(video.vod_id)"
          />
        </div>
      </section>

      <section>
        <div class="mb-8 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-2 h-10 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full shadow-lg shadow-blue-500/50" />
            <div class="flex items-center gap-3">
              <Clock class="w-7 h-7 text-blue-500" />
              <h2 class="text-3xl font-black text-white tracking-wide">
                最新更新
              </h2>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <VideoCard
            v-for="video in newVideoList"
            :key="video.vod_id"
            :video="video"
            @click="goToDetail(video.vod_id)"
          />
        </div>
      </section>

      <section>
        <div class="mb-8 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-2 h-10 bg-gradient-to-b from-pink-500 to-purple-500 rounded-full shadow-lg shadow-pink-500/50" />
            <div class="flex items-center gap-3">
              <Zap class="w-7 h-7 text-pink-500" />
              <h2 class="text-3xl font-black text-white tracking-wide">
                动漫专区
              </h2>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <VideoCard
            v-for="video in animeVideoList"
            :key="video.vod_id"
            :video="video"
            @click="goToDetail(video.vod_id)"
          />
        </div>
      </section>

      <section>
        <div class="mb-8 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-2 h-10 bg-gradient-to-b from-green-500 to-emerald-500 rounded-full shadow-lg shadow-green-500/50" />
            <div class="flex items-center gap-3">
              <Layers class="w-7 h-7 text-green-500" />
              <h2 class="text-3xl font-black text-white tracking-wide">
                综艺娱乐
              </h2>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <VideoCard
            v-for="video in varietyVideoList"
            :key="video.vod_id"
            :video="video"
            @click="goToDetail(video.vod_id)"
          />
        </div>
      </section>
    </main>

    <footer class="mt-24 border-t border-white/5 pt-16 pb-10 bg-gradient-to-t from-slate-950/80 to-transparent backdrop-blur-sm">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="text-center space-y-5">
          <p class="text-gray-400 text-sm leading-relaxed max-w-2xl mx-auto">
            本网站所有内容均来自互联网分享站点所提供的公开引用资源，未提供影视资源上传、存储服务，如有侵权，请联系删除。
          </p>
          <p class="text-xs text-gray-600 font-medium">
            © 2025 苍穹影视 - 只为给您最好的观影体验
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { onMounted, ref, onUnmounted } from 'vue'
import NavBar from '@/components/NavBar.vue'
import VideoCard from '@/components/VideoCard.vue'
import { PlayCircle, Calendar, MapPin, Layers, Eye, Star, TrendingUp, Flame, Clock, Zap } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { apiCall } from '@/utils/api'

const featuredVideo = ref(null)
const videoList = ref([])
const hotVideoList = ref([])
const newVideoList = ref([])
const animeVideoList = ref([])
const varietyVideoList = ref([])

const liveViewers = ref(0)

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

onMounted(async () => {
  loadLiveViewers()
  
  const viewersInterval = setInterval(updateLiveViewers, 30000)

  window.addEventListener('liveViewersUpdated', () => {
    const savedViewers = localStorage.getItem('liveViewers')
    if (savedViewers) {
      liveViewers.value = parseInt(savedViewers)
    }
  })

  try {
    const data = await apiCall({ ac: 'detail' })

    if (data.list && data.list.length > 0) {
      const sortedList = [...data.list].sort((a, b) => (b.vod_hits || 0) - (a.vod_hits || 0))
      videoList.value = sortedList
      hotVideoList.value = sortedList.slice(0, 12)
      newVideoList.value = [...data.list].sort((a, b) => new Date(b.vod_time) - new Date(a.vod_time)).slice(0, 12)
      
      const animeList = data.list.filter(v => v.vod_type_name === '动漫' || v.vod_type === '3').slice(0, 8)
      const varietyList = data.list.filter(v => v.vod_type_name === '综艺' || v.vod_type === '4').slice(0, 8)
      
      animeVideoList.value = animeList.length > 0 ? animeList : sortedList.slice(6, 14)
      varietyVideoList.value = varietyList.length > 0 ? varietyList : sortedList.slice(12, 20)
      
      featuredVideo.value = sortedList[0]
    }
  } catch (error) {
    console.error('加载失败', error)
  }
  
  onUnmounted(() => {
    clearInterval(viewersInterval)
    window.removeEventListener('liveViewersUpdated', () => {})
  })
})

const goDetail = () => {
  router.push('/category/1')
}
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

    <header v-if="featuredVideo" class="relative w-full overflow-hidden min-h-[75vh] md:min-h-[90vh] flex items-center">
      <div class="absolute inset-0 z-0">
        <img
          :src="featuredVideo.vod_pic"
          class="h-full w-full object-cover opacity-20 blur-3xl scale-125"
        >
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
        <div class="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/20 to-transparent" />
      </div>

      <div class="absolute inset-0 z-0 md:hidden">
        <img
          :src="featuredVideo.vod_pic"
          class="w-full h-full object-cover object-top opacity-50"
        >
        <div class="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-transparent to-slate-950" />
      </div>

      <div class="relative z-10 mx-auto flex w-full max-w-7xl flex-col md:flex-row items-end md:items-center gap-10 px-4 pb-20 md:pb-24 pt-36 sm:px-6 lg:px-8">
        <div class="flex-1 space-y-7 text-center md:text-left w-full">
          <div class="flex flex-wrap items-center justify-center md:justify-start gap-3">
            <span class="px-5 py-2 rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 shadow-[0_0_30px_rgba(249,115,22,0.5)] text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5">
              <Flame class="w-3.5 h-3.5 fill-yellow-300" />
              王牌推荐
            </span>
            <span class="flex items-center gap-1.5 text-xs font-semibold text-gray-200 bg-black/60 border border-white/15 px-3.5 py-2 rounded-full backdrop-blur-xl">
              <Calendar class="w-4 h-4" /> {{ featuredVideo.vod_year || '2025' }}
            </span>
            <span class="flex items-center gap-1.5 text-xs font-semibold text-gray-200 bg-black/60 border border-white/15 px-3.5 py-2 rounded-full backdrop-blur-xl">
              <MapPin class="w-4 h-4" /> {{ featuredVideo.vod_area || '未知' }}
            </span>
            <span class="flex items-center gap-1.5 text-xs font-black text-yellow-400 bg-yellow-500/15 border border-yellow-500/40 px-3.5 py-2 rounded-full backdrop-blur-xl">
              <Star class="w-4 h-4 fill-yellow-400" /> 9.8
            </span>
          </div>

          <h1 class="text-5xl md:text-6xl lg:text-8xl font-black text-white leading-tight">
            <span class="bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
              {{ featuredVideo.vod_name }}
            </span>
          </h1>

          <p class="mx-auto md:mx-0 max-w-2xl text-base md:text-lg text-gray-300 line-clamp-2 md:line-clamp-3 leading-relaxed">
            {{ stripHtml(featuredVideo.vod_blurb || featuredVideo.vod_content) }}
          </p>

          <div class="flex items-center justify-center md:justify-start gap-5 pt-6">
            <button
              @click="goToDetail(featuredVideo.vod_id)"
              class="cursor-pointer w-full md:w-auto group flex items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 px-12 py-5 font-black text-white transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(249,115,22,0.6)] active:scale-95"
            >
              <PlayCircle class="h-7 w-7 fill-current transition-transform group-hover:rotate-12" />
              立即播放
            </button>
            <button
              @click="goDetail"
              class="hidden md:flex cursor-pointer items-center justify-center gap-3 rounded-3xl bg-white/10 border border-white/20 px-10 py-5 font-bold text-white backdrop-blur-xl transition-all hover:bg-white/20 hover:border-white/30 active:scale-95"
            >
              <Layers class="h-6 w-6" />
              浏览更多
            </button>
          </div>
        </div>

        <div class="hidden md:block w-[320px] lg:w-[400px] flex-shrink-0 relative group">
          <div class="absolute -inset-2 bg-gradient-to-tr from-orange-500 via-red-500 to-pink-500 rounded-[2.5rem] blur-2xl opacity-50 group-hover:opacity-80 transition duration-1000" />
          <img
            :src="featuredVideo.vod_pic"
            class="relative w-full rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] border-2 border-white/10 transform transition duration-1000 group-hover:-translate-y-6 group-hover:rotate-2 object-cover aspect-[2/3]"
            alt="Featured Poster"
          >
          <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
      </div>
    </header>

    <header v-else class="h-[75vh] w-full flex items-center justify-center bg-slate-950">
      <div class="animate-pulse flex flex-col items-center gap-5">
        <div class="h-12 w-80 bg-white/5 rounded-2xl" />
        <div class="h-6 w-64 bg-white/5 rounded-xl" />
        <div class="h-4 w-56 bg-white/5 rounded-lg" />
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 relative z-20 space-y-24">
      <section>
        <div class="mb-10 flex items-center justify-between">
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

        <div class="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:gap-7">
          <VideoCard
            v-for="video in hotVideoList"
            :key="video.vod_id"
            :video="video"
            @click="goToDetail(video.vod_id)"
          />
        </div>
      </section>

      <section>
        <div class="mb-10 flex items-center justify-between">
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

        <div class="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:gap-7">
          <VideoCard
            v-for="video in newVideoList"
            :key="video.vod_id"
            :video="video"
            @click="goToDetail(video.vod_id)"
          />
        </div>
      </section>

      <section>
        <div class="mb-10 flex items-center justify-between">
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

        <div class="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:gap-7">
          <VideoCard
            v-for="video in animeVideoList"
            :key="video.vod_id"
            :video="video"
            @click="goToDetail(video.vod_id)"
          />
        </div>
      </section>

      <section>
        <div class="mb-10 flex items-center justify-between">
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

        <div class="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 xl:gap-7">
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

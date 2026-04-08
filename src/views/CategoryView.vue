<script setup>
import { ref, onMounted, watch, nextTick, onActivated, onDeactivated, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import VideoCard from '@/components/VideoCard.vue'
import { LayoutGrid, ChevronLeft, ChevronRight, Filter, Search, Database, Layers, X } from 'lucide-vue-next'
import { apiCall, videoSources, setCurrentSource, initSourceSetting, fetchFromAllSources } from '@/utils/api'

const route = useRoute()
const router = useRouter()

// 在 script setup 中添加
const scrollContainer = ref(null) // 1. 定义 ref 变量

// 2. 定义滚动处理函数
const handleWheel = (e) => {
  // e.deltaY > 0 表示向下滚动（对应向右）
  // e.deltaY < 0 表示向上滚动（对应向左）
  if (scrollContainer.value) {
    scrollContainer.value.scrollLeft += e.deltaY
  }
}

// --- 状态定义 ---
const loading = ref(true)
const typePid = ref('1')
const curTypeId = ref('')
const categoryList = ref([]) // 所有分类菜单
const allCategories = ref([]) // 所有分类数据
const videoList = ref([]) // 当前页视频列表
const currentCategory = ref({}) // 当前选中的分类信息
const parentCategory = ref({}) // 父级分类信息
const pagination = ref({
  page: 1, // 当前页
  pagecount: 1, // 总页数
  total: 0 // 总条数
})

// 视频源相关
const currentSourceIndex = ref(0)
const useAllSources = ref(true) // 默认使用所有源

// 搜索相关
const searchQuery = ref('')
const isSearching = ref(false)
const searchResults = ref([])

// --- 滚动位置缓存 ---
const scrollPosition = ref(0) // 保存滚动位置

// 初始化设置
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

// --- 核心：获取所有分类 (用于顶部导航) ---
const fetchCategories = async (id = '') => {
  try {
    typePid.value = id || route.params.id
    console.log('typePid.value', typePid.value)

    const data = await apiCall({ ac: 'list' })
    allCategories.value = data.class || []
    
    // 获取当前分类的子分类
    categoryList.value = data.class.filter(item => item.type_pid == typePid.value) || []
    
    // 获取父级分类信息
    parentCategory.value = data.class.find(item => item.type_id == typePid.value) || { type_name: '全部视频' }
    
    updateCurrentCategoryInfo()
  } catch (e) {
    console.error('获取分类失败', e)
  }
}

// --- 核心：获取视频列表 (带分页) ---
const fetchVideos = async (page = 1) => {
  loading.value = true
  isSearching.value = false
  try {
    let data
    const params = { ac: 'detail', pg: page }
    if (curTypeId.value) {
      params.t = curTypeId.value
    }
    
    if (useAllSources.value) {
      // 从所有源获取并整合数据 - 获取更多页数据
      data = await fetchFromAllSources(params, 0, 20)
    } else {
      // 从当前选中的源获取
      setCurrentSource(currentSourceIndex.value)
      data = await apiCall(params)
    }

    videoList.value = data.list || []

    // 更新分页信息
    pagination.value = {
      page: page,
      pagecount: Math.ceil((data.total || data.list?.length || 0) / 20) || 1,
      total: data.total || data.list?.length || 0
    }
  } catch (e) {
    console.error('获取视频列表失败', e)
    videoList.value = []
  } finally {
    loading.value = false
  }
}

// --- 搜索视频 ---
const searchVideos = async () => {
  if (!searchQuery.value.trim()) {
    isSearching.value = false
    fetchVideos(1)
    return
  }
  
  loading.value = true
  isSearching.value = true
  try {
    let data
    if (useAllSources.value) {
      // 从所有源搜索 - 获取更多结果
      data = await fetchFromAllSources({ ac: 'detail', wd: searchQuery.value.trim() }, 0, 10)
    } else {
      // 从当前选中的源搜索
      setCurrentSource(currentSourceIndex.value)
      data = await apiCall({ ac: 'detail', wd: searchQuery.value.trim() })
    }
    
    searchResults.value = data.list || []
    videoList.value = data.list || []
    
    // 更新分页信息
    pagination.value = {
      page: 1,
      pagecount: 1,
      total: data.list?.length || 0
    }
  } catch (e) {
    console.error('搜索视频失败', e)
    videoList.value = []
    searchResults.value = []
  } finally {
    loading.value = false
  }
}

// 清除搜索
const clearSearch = () => {
  searchQuery.value = ''
  isSearching.value = false
  fetchVideos(1)
}

// --- 辅助：根据ID找到当前分类的名字 ---
const updateCurrentCategoryInfo = () => {
  if (curTypeId.value && allCategories.value.length > 0) {
    currentCategory.value = allCategories.value.find(c => c.type_id == curTypeId.value) || {}
  } else {
    currentCategory.value = {}
  }
}

// --- 交互：翻页 ---
const changePage = (newPage) => {
  if (newPage < 1 || newPage > pagination.value.pagecount) return
  fetchVideos(newPage)
  // 翻页后滚动到顶部
  window.scrollTo({ top: 0, behavior: 'smooth' })
  // 重置滚动位置缓存
  scrollPosition.value = 0
}

// --- 交互：切换分类 ---
const changeType = (id) => {
  curTypeId.value = id
  fetchVideos(1) // 切换分类后重置回第一页
  // 重置滚动位置缓存
  scrollPosition.value = 0
}

// --- 交互：跳转详情 ---
const goToDetail = (id) => {
  // 保存当前滚动位置
  scrollPosition.value = window.scrollY
  console.log('Going to detail, saved scroll position:', scrollPosition.value)
  router.push(`/player/${id}`)
}

// --- 保存滚动位置 ---
const saveScrollPosition = () => {
  scrollPosition.value = window.scrollY
}

// 切换视频源
const switchVideoSource = (index) => {
  currentSourceIndex.value = index
  useAllSources.value = false
  localStorage.setItem('useAllSources', 'false')
  setCurrentSource(index)
  fetchVideos(1)
}

// 使用所有源
const useAllVideoSources = () => {
  useAllSources.value = true
  localStorage.setItem('useAllSources', 'true')
  fetchVideos(1)
}

// --- 生命周期 ---
onMounted(async () => {
  initSettings()
  await fetchCategories() // 先获取分类菜单
  fetchVideos(1) // 再获取第一页数据
})

onActivated(() => {
  console.log('CategoryView activated, current scroll position:', scrollPosition.value)
  // 如果已经有数据，直接恢复滚动位置
  if (videoList.value.length > 0) {
    nextTick(() => {
      if (scrollPosition.value > 0) {
        window.scrollTo(0, scrollPosition.value)
        console.log('Restored scroll position:', scrollPosition.value)
      }
    })
  }
})

onDeactivated(() => {
  console.log('CategoryView deactivated, saving scroll position:', window.scrollY)
  saveScrollPosition()
})

watch(curTypeId,
  () => {
    fetchVideos(1) // 重置回第一页
  }
)
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pb-20">
    <!-- 背景装饰 -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div class="absolute top-0 left-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl animate-pulse" style="animation-duration: 8s;" />
      <div class="absolute top-1/3 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl animate-pulse" style="animation-duration: 10s; animation-delay: 2s;" />
      <div class="absolute bottom-1/4 left-1/3 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl animate-pulse" style="animation-duration: 12s; animation-delay: 4s;" />
    </div>

    <NavBar @change="fetchCategories" />

    <div class="pt-24 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
      <!-- 1. 头部区域：标题 + 搜索 + 视频源选择 -->
      <div class="mb-8 space-y-6">
        <!-- 标题和搜索 -->
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 class="text-3xl font-black text-white flex items-center gap-3">
            <div class="w-2 h-10 bg-gradient-to-b from-orange-500 to-red-500 rounded-full shadow-lg shadow-orange-500/50" />
            <LayoutGrid class="w-8 h-8 text-orange-500" />
            <span class="bg-gradient-to-r from-white via-orange-200 to-pink-200 bg-clip-text text-transparent">
              {{ isSearching ? '搜索结果' : (currentCategory.type_name || parentCategory.type_name || '全部视频') }}
            </span>
            <span class="text-sm font-normal text-gray-500 mt-2">
              共 {{ pagination.total }} 部影片
            </span>
          </h1>
          
          <!-- 搜索框 -->
          <div class="flex items-center gap-2">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                v-model="searchQuery"
                @keyup.enter="searchVideos"
                type="text"
                placeholder="搜索视频..."
                class="w-full md:w-64 pl-10 pr-10 py-2.5 bg-[#1a1b23] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 transition-all"
              />
              <button
                v-if="searchQuery"
                @click="clearSearch"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
            <button
              @click="searchVideos"
              class="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl text-white font-medium hover:shadow-lg hover:shadow-orange-500/30 transition-all active:scale-95"
            >
              搜索
            </button>
          </div>
        </div>

        <!-- 视频源选择 -->
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2 text-gray-400 mr-2">
            <Database class="w-4 h-4" />
            <span class="text-sm font-medium">视频源:</span>
          </div>
          <button 
            @click="useAllVideoSources" 
            class="px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border-2"
            :class="useAllSources ? 'bg-gradient-to-r from-orange-500 to-red-500 border-orange-400 text-white shadow-lg shadow-orange-500/40' : 'bg-[#1a1b23] border-transparent text-gray-400 hover:text-white hover:bg-[#252730] hover:border-white/10'"
          >
            <Layers class="w-4 h-4" />
            全部源
          </button>
          <button 
            v-for="(source, index) in videoSources" 
            :key="index" 
            @click="switchVideoSource(index)" 
            class="px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border-2"
            :class="!useAllSources && currentSourceIndex === index ? 'bg-gradient-to-r from-orange-500 to-red-500 border-orange-400 text-white shadow-lg shadow-orange-500/40' : 'bg-[#1a1b23] border-transparent text-gray-400 hover:text-white hover:bg-[#252730] hover:border-white/10'"
          >
            <Database class="w-4 h-4" />
            {{ source.name }}
          </button>
        </div>

        <!-- 横向滚动分类条 -->
        <div class="relative group">
          <div
            ref="scrollContainer"
            @wheel.prevent="handleWheel"
            class="flex items-center gap-3 overflow-x-auto pb-4 thin-scrollbar"
          >
            <span class="flex items-center gap-1 text-sm font-bold text-gray-400 mr-2 flex-shrink-0">
              <Filter class="w-4 h-4" /> 筛选:
            </span>

            <!-- 全部选项 -->
            <div
              @click="changeType('')"
              class="px-4 cursor-pointer py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap border-2"
              :class="!curTypeId
                ? 'bg-gradient-to-r from-orange-500 to-red-500 border-orange-400 text-white shadow-lg shadow-orange-500/40'
                : 'bg-[#1a1b23] border-transparent text-gray-400 hover:text-white hover:bg-[#252730] hover:border-white/10'"
            >
              全部
            </div>

            <div
              v-for="cat in categoryList"
              :key="cat.type_id"
              @click="changeType(cat.type_id)"
              class="px-4 cursor-pointer py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap border-2"
              :class="curTypeId == cat.type_id
                ? 'bg-gradient-to-r from-orange-500 to-red-500 border-orange-400 text-white shadow-lg shadow-orange-500/40'
                : 'bg-[#1a1b23] border-transparent text-gray-400 hover:text-white hover:bg-[#252730] hover:border-white/10'"
            >
              {{ cat.type_name }}
            </div>
          </div>
          <!-- 渐变遮罩提示可滚动 -->
          <div class="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-[#0f1014] to-transparent pointer-events-none md:hidden" />
        </div>
      </div>

      <!-- 2. 视频列表区域 -->

      <!-- Loading 骨架屏 - 5列布局 -->
      <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
        <div v-for="i in 15" :key="i" class="animate-pulse">
          <div class="aspect-[2/3] bg-white/5 rounded-2xl mb-3" />
          <div class="h-4 w-3/4 bg-white/5 rounded-lg mb-2" />
          <div class="h-3 w-1/2 bg-white/5 rounded" />
        </div>
      </div>

      <!-- 真实数据列表 - 5列布局 -->
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
        <VideoCard
          v-for="video in videoList"
          :key="video.vod_id"
          :video="video"
          @click="goToDetail(video.vod_id)"
        />
      </div>

      <!-- 空状态 -->
      <div v-if="!loading && videoList.length === 0" class="py-20 text-center">
        <div class="text-6xl mb-4">
          🦖
        </div>
        <p class="text-gray-500 text-lg">
          {{ isSearching ? '没有找到相关视频' : '该分类下暂时没有影片' }}
        </p>
        <button
          v-if="isSearching"
          @click="clearSearch"
          class="mt-4 px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl text-white font-medium hover:shadow-lg transition-all"
        >
          返回全部视频
        </button>
      </div>

      <!-- 3. 分页控件 -->
      <div v-if="!loading && videoList.length > 0 && pagination.pagecount > 1" class="mt-12 flex justify-center items-center gap-4">
        <!-- 上一页 -->
        <button
          @click="changePage(pagination.page - 1)"
          :disabled="pagination.page === 1"
          class="flex items-center justify-center w-12 h-12 rounded-xl border border-white/10 bg-white/5 text-gray-300 transition-all hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white hover:border-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft class="w-5 h-5" />
        </button>

        <!-- 页码显示 -->
        <div class="flex items-center gap-2 text-sm font-bold">
          <span class="text-white text-lg">{{ pagination.page }}</span>
          <span class="text-gray-600">/</span>
          <span class="text-gray-400">{{ pagination.pagecount }}</span>
        </div>

        <!-- 下一页 -->
        <button
          @click="changePage(pagination.page + 1)"
          :disabled="pagination.page === pagination.pagecount"
          class="flex items-center justify-center w-12 h-12 rounded-xl border border-white/10 bg-white/5 text-gray-300 transition-all hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white hover:border-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight class="w-5 h-5" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 1. Chrome, Edge, Safari 的自定义样式 */
.thin-scrollbar::-webkit-scrollbar {
  height: 6px; /* 这里控制粗细，6px 比较优雅 */
}
.thin-scrollbar::-webkit-scrollbar-track {
  background: transparent; /* 轨道背景透明 */
}
.thin-scrollbar::-webkit-scrollbar-thumb {
  border-radius: 10px; /* 圆角，像胶囊一样 */
  background-color: rgb(255 255 255 / 15%); /* 滚动条颜色：半透明白 */
  transition: background-color 0.3s;
}

/* 鼠标悬停在滚动条上时变亮 */
.thin-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgb(255 255 255 / 30%);
}

/* 2. Firefox 的自定义样式 */
.thin-scrollbar {
  scrollbar-width: thin; /* 设为细 */
  scrollbar-color: rgb(255 255 255 / 15%) transparent; /* 滑块颜色 轨道颜色 */
}
</style>
